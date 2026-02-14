import Docker from "dockerode";

// Singleton Docker client
let docker: Docker | null = null;

export function getDocker(): Docker {
  if (!docker) {
    docker = new Docker({
      socketPath: process.env.DOCKER_SOCKET ?? "/var/run/docker.sock",
    });
  }
  return docker;
}

// Sandbox container configuration
export const SANDBOX_IMAGE =
  process.env.SANDBOX_IMAGE ?? "superagent-sandbox:latest";

export const SANDBOX_DEFAULTS = {
  cpuQuota: 200000, // 2 cores (100000 per core)
  cpuPeriod: 100000,
  memory: 2 * 1024 * 1024 * 1024, // 2 GB
  memorySwap: 4 * 1024 * 1024 * 1024, // 4 GB
  pidsLimit: 256,
  workspacePath: "/workspace",
  // Ports that dev servers commonly use inside the container
  internalPorts: [3000, 3001, 5173, 8000, 8080],
} as const;

export interface ContainerInfo {
  containerId: string;
  name: string;
  status: string;
  ports: Record<number, number>; // internal → host
  workspacePath: string;
}

/**
 * Create a sandbox container for a project.
 * Returns the container ID and port mappings.
 */
export async function createSandboxContainer(opts: {
  name: string;
  volumePath: string; // host path to mount as /workspace
  env?: Record<string, string>;
}): Promise<ContainerInfo> {
  const docker = getDocker();
  const { name, volumePath, env = {} } = opts;

  const envArray = Object.entries(env).map(([k, v]) => `${k}=${v}`);

  // Create port bindings — let Docker assign host ports
  const exposedPorts: Record<string, object> = {};
  const portBindings: Record<string, Array<{ HostPort: string }>> = {};

  for (const port of SANDBOX_DEFAULTS.internalPorts) {
    exposedPorts[`${port}/tcp`] = {};
    portBindings[`${port}/tcp`] = [{ HostPort: "0" }]; // 0 = auto-assign
  }

  const container = await docker.createContainer({
    Image: SANDBOX_IMAGE,
    name,
    Env: envArray,
    ExposedPorts: exposedPorts,
    HostConfig: {
      Binds: [`${volumePath}:${SANDBOX_DEFAULTS.workspacePath}`],
      PortBindings: portBindings,
      CpuQuota: SANDBOX_DEFAULTS.cpuQuota,
      CpuPeriod: SANDBOX_DEFAULTS.cpuPeriod,
      Memory: SANDBOX_DEFAULTS.memory,
      MemorySwap: SANDBOX_DEFAULTS.memorySwap,
      PidsLimit: SANDBOX_DEFAULTS.pidsLimit,
      // Security
      CapDrop: ["ALL"],
      CapAdd: ["CHOWN", "SETUID", "SETGID", "NET_BIND_SERVICE"],
      SecurityOpt: ["no-new-privileges"],
      ReadonlyRootfs: false, // need writable for npm installs etc.
      NetworkMode: "bridge",
    },
    WorkingDir: SANDBOX_DEFAULTS.workspacePath,
    User: "sandbox",
    Tty: true,
    OpenStdin: true,
  });

  await container.start();

  // Read actual port mappings
  const info = await container.inspect();
  const ports: Record<number, number> = {};
  const networkPorts = info.NetworkSettings?.Ports ?? {};

  for (const port of SANDBOX_DEFAULTS.internalPorts) {
    const binding = networkPorts[`${port}/tcp`];
    if (binding && binding.length > 0) {
      ports[port] = parseInt(binding[0].HostPort, 10);
    }
  }

  return {
    containerId: container.id,
    name,
    status: "running",
    ports,
    workspacePath: SANDBOX_DEFAULTS.workspacePath,
  };
}

/**
 * Stop and remove a container.
 */
export async function removeSandboxContainer(
  containerId: string
): Promise<void> {
  const docker = getDocker();
  const container = docker.getContainer(containerId);
  try {
    await container.stop({ t: 5 });
  } catch {
    // might already be stopped
  }
  await container.remove({ force: true });
}

/**
 * Pause (hibernate) a container.
 */
export async function pauseSandboxContainer(
  containerId: string
): Promise<void> {
  const docker = getDocker();
  await docker.getContainer(containerId).pause();
}

/**
 * Unpause (resume) a container.
 */
export async function unpauseSandboxContainer(
  containerId: string
): Promise<void> {
  const docker = getDocker();
  await docker.getContainer(containerId).unpause();
}

/**
 * Get container status.
 */
export async function getContainerStatus(
  containerId: string
): Promise<string> {
  const docker = getDocker();
  const info = await docker.getContainer(containerId).inspect();
  return info.State?.Status ?? "unknown";
}
