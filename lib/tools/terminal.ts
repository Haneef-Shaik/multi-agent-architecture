import { execInContainer } from "@/lib/sandbox/exec";
import type { ToolResult } from "@/types/tool";

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes

/**
 * Execute a shell command in the sandbox.
 */
export async function executeCommand(
  containerId: string,
  command: string,
  opts: {
    cwd?: string;
    env?: Record<string, string>;
    timeoutMs?: number;
  } = {}
): Promise<ToolResult> {
  const { cwd, env, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;

  const result = await execInContainer(containerId, command, {
    cwd,
    env,
    timeoutMs,
  });

  const output = [
    result.stdout ? `stdout:\n${result.stdout}` : "",
    result.stderr ? `stderr:\n${result.stderr}` : "",
    result.timedOut ? `\n[Command timed out after ${timeoutMs / 1000}s]` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    success: result.exitCode === 0,
    output: output || "(no output)",
    exitCode: result.exitCode,
  };
}

/**
 * Start a long-running process (e.g., dev server).
 * Runs in the background and returns the PID.
 */
export async function startProcess(
  containerId: string,
  command: string,
  opts: { cwd?: string; env?: Record<string, string> } = {}
): Promise<ToolResult> {
  const { cwd, env } = opts;

  // Run in background, capture PID
  const bgCmd = `nohup ${command} > /tmp/proc-$$.log 2>&1 & echo $!`;
  const result = await execInContainer(containerId, bgCmd, {
    cwd,
    env,
    timeoutMs: 10_000,
  });

  if (result.exitCode !== 0) {
    return {
      success: false,
      output: result.stderr || "Failed to start process",
    };
  }

  const pid = result.stdout.trim();
  return {
    success: true,
    output: `Process started with PID: ${pid}\nCommand: ${command}`,
  };
}

/**
 * Kill a process by PID.
 */
export async function killProcess(
  containerId: string,
  pid: string | number
): Promise<ToolResult> {
  const result = await execInContainer(
    containerId,
    `kill -TERM ${pid} 2>/dev/null || kill -KILL ${pid} 2>/dev/null`,
    { timeoutMs: 5_000 }
  );

  return {
    success: true,
    output: `Sent kill signal to PID ${pid}`,
  };
}

/**
 * List running processes.
 */
export async function listProcesses(
  containerId: string
): Promise<ToolResult> {
  const result = await execInContainer(
    containerId,
    "ps aux --sort=-%mem | head -20",
    { timeoutMs: 5_000 }
  );

  return {
    success: result.exitCode === 0,
    output: result.stdout || "No processes found",
  };
}
