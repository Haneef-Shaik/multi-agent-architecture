import { getDocker, SANDBOX_DEFAULTS } from "./docker-client";

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

const MAX_OUTPUT_BYTES = 100 * 1024; // 100KB per stream
const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes

/**
 * Execute a command inside a sandbox container.
 * Returns stdout, stderr, exitCode, and whether it timed out.
 */
export async function execInContainer(
  containerId: string,
  command: string | string[],
  opts: {
    cwd?: string;
    env?: Record<string, string>;
    timeoutMs?: number;
    user?: string;
  } = {}
): Promise<ExecResult> {
  const docker = getDocker();
  const container = docker.getContainer(containerId);
  const {
    cwd = SANDBOX_DEFAULTS.workspacePath,
    env = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    user = "sandbox",
  } = opts;

  const cmd = typeof command === "string" ? ["bash", "-c", command] : command;
  const envArray = Object.entries(env).map(([k, v]) => `${k}=${v}`);

  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
    WorkingDir: cwd,
    Env: envArray.length > 0 ? envArray : undefined,
    User: user,
  });

  const stream = await exec.start({ Tty: false });

  return new Promise<ExecResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let resolved = false;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      exec.inspect().then((info) => {
        resolve({
          exitCode: info.ExitCode ?? (timedOut ? 124 : 1),
          stdout: truncate(stdout, MAX_OUTPUT_BYTES),
          stderr: truncate(stderr, MAX_OUTPUT_BYTES),
          timedOut,
        });
      }).catch(() => {
        resolve({
          exitCode: timedOut ? 124 : 1,
          stdout: truncate(stdout, MAX_OUTPUT_BYTES),
          stderr: truncate(stderr, MAX_OUTPUT_BYTES),
          timedOut,
        });
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      stream.destroy();
      finish();
    }, timeoutMs);

    // Dockerode demux: split multiplexed stream into stdout/stderr
    const passThrough = {
      stdout: {
        write(chunk: Buffer) {
          stdout += chunk.toString("utf-8");
          return true;
        },
        end() {},
      },
      stderr: {
        write(chunk: Buffer) {
          stderr += chunk.toString("utf-8");
          return true;
        },
        end() {},
      },
    };

    docker.getContainer(containerId).modem.demuxStream(
      stream,
      passThrough.stdout as unknown as NodeJS.WritableStream,
      passThrough.stderr as unknown as NodeJS.WritableStream
    );

    stream.on("end", finish);
    stream.on("error", finish);
  });
}

/**
 * Start an interactive shell session (for terminal UI).
 * Returns the exec instance and stream for bidirectional I/O.
 */
export async function startInteractiveShell(
  containerId: string,
  opts: { cols?: number; rows?: number } = {}
) {
  const docker = getDocker();
  const container = docker.getContainer(containerId);
  const { cols = 120, rows = 30 } = opts;

  const exec = await container.exec({
    Cmd: ["bash"],
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    User: "sandbox",
    WorkingDir: SANDBOX_DEFAULTS.workspacePath,
  });

  const stream = await exec.start({
    hijack: true,
    stdin: true,
    Tty: true,
  });

  // Resize the PTY
  await exec.resize({ w: cols, h: rows });

  return { exec, stream };
}

/**
 * Resize an interactive shell PTY.
 */
export async function resizeShell(
  execId: string,
  cols: number,
  rows: number
): Promise<void> {
  const docker = getDocker();
  // Use the Docker API directly to resize
  await docker.getExec(execId).resize({ w: cols, h: rows });
}

function truncate(str: string, maxBytes: number): string {
  const buf = Buffer.from(str, "utf-8");
  if (buf.length <= maxBytes) return str;
  return (
    buf.subarray(0, maxBytes).toString("utf-8") +
    `\n... [truncated: ${buf.length - maxBytes} bytes omitted]`
  );
}
