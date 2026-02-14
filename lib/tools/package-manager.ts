import { execInContainer } from "@/lib/sandbox/exec";
import type { ToolResult } from "@/types/tool";

const INSTALL_TIMEOUT = 120_000; // 2 minutes for installs
const SCRIPT_TIMEOUT = 60_000; // 1 minute for scripts

type PackageManager = "npm" | "bun" | "pnpm" | "yarn" | "pip";

/**
 * Detect the package manager used in the project.
 */
export async function detectPackageManager(
  containerId: string
): Promise<PackageManager> {
  const checks = [
    { file: "bun.lockb", pm: "bun" as const },
    { file: "bun.lock", pm: "bun" as const },
    { file: "pnpm-lock.yaml", pm: "pnpm" as const },
    { file: "yarn.lock", pm: "yarn" as const },
    { file: "package-lock.json", pm: "npm" as const },
    { file: "requirements.txt", pm: "pip" as const },
    { file: "pyproject.toml", pm: "pip" as const },
  ];

  for (const check of checks) {
    const result = await execInContainer(
      containerId,
      `test -f "/workspace/${check.file}" && echo "found"`,
      { timeoutMs: 5_000 }
    );
    if (result.stdout.trim() === "found") {
      return check.pm;
    }
  }

  // Default to npm if package.json exists, else bun
  const hasPackageJson = await execInContainer(
    containerId,
    'test -f "/workspace/package.json" && echo "found"',
    { timeoutMs: 5_000 }
  );

  return hasPackageJson.stdout.trim() === "found" ? "npm" : "bun";
}

/**
 * Install all project dependencies.
 */
export async function installDependencies(
  containerId: string,
  pm?: PackageManager
): Promise<ToolResult> {
  const packageManager = pm ?? (await detectPackageManager(containerId));

  const cmds: Record<PackageManager, string> = {
    npm: "npm install",
    bun: "bun install",
    pnpm: "pnpm install",
    yarn: "yarn install",
    pip: "pip install -r requirements.txt",
  };

  const result = await execInContainer(containerId, cmds[packageManager], {
    timeoutMs: INSTALL_TIMEOUT,
  });

  return {
    success: result.exitCode === 0,
    output: result.stdout + (result.stderr ? `\n${result.stderr}` : ""),
  };
}

/**
 * Install specific packages.
 */
export async function installPackages(
  containerId: string,
  packages: string[],
  opts: { dev?: boolean; pm?: PackageManager } = {}
): Promise<ToolResult> {
  const { dev = false, pm } = opts;
  const packageManager = pm ?? (await detectPackageManager(containerId));
  const pkgList = packages.join(" ");

  const cmds: Record<PackageManager, string> = {
    npm: `npm install ${dev ? "--save-dev" : ""} ${pkgList}`,
    bun: `bun add ${dev ? "--dev" : ""} ${pkgList}`,
    pnpm: `pnpm add ${dev ? "--save-dev" : ""} ${pkgList}`,
    yarn: `yarn add ${dev ? "--dev" : ""} ${pkgList}`,
    pip: `pip install ${pkgList}`,
  };

  const result = await execInContainer(containerId, cmds[packageManager], {
    timeoutMs: INSTALL_TIMEOUT,
  });

  return {
    success: result.exitCode === 0,
    output: result.stdout + (result.stderr ? `\n${result.stderr}` : ""),
  };
}

/**
 * Uninstall packages.
 */
export async function uninstallPackages(
  containerId: string,
  packages: string[],
  opts: { pm?: PackageManager } = {}
): Promise<ToolResult> {
  const { pm } = opts;
  const packageManager = pm ?? (await detectPackageManager(containerId));
  const pkgList = packages.join(" ");

  const cmds: Record<PackageManager, string> = {
    npm: `npm uninstall ${pkgList}`,
    bun: `bun remove ${pkgList}`,
    pnpm: `pnpm remove ${pkgList}`,
    yarn: `yarn remove ${pkgList}`,
    pip: `pip uninstall -y ${pkgList}`,
  };

  const result = await execInContainer(containerId, cmds[packageManager], {
    timeoutMs: INSTALL_TIMEOUT,
  });

  return {
    success: result.exitCode === 0,
    output: result.stdout + (result.stderr ? `\n${result.stderr}` : ""),
  };
}

/**
 * Run a package.json script.
 */
export async function runScript(
  containerId: string,
  scriptName: string,
  opts: { pm?: PackageManager; timeoutMs?: number } = {}
): Promise<ToolResult> {
  const { pm, timeoutMs = SCRIPT_TIMEOUT } = opts;
  const packageManager = pm ?? (await detectPackageManager(containerId));

  const cmds: Record<PackageManager, string> = {
    npm: `npm run ${scriptName}`,
    bun: `bun run ${scriptName}`,
    pnpm: `pnpm run ${scriptName}`,
    yarn: `yarn ${scriptName}`,
    pip: `python -m ${scriptName}`,
  };

  const result = await execInContainer(containerId, cmds[packageManager], {
    timeoutMs,
  });

  return {
    success: result.exitCode === 0,
    output: result.stdout + (result.stderr ? `\n${result.stderr}` : ""),
  };
}

/**
 * List installed dependencies.
 */
export async function listDependencies(
  containerId: string,
  opts: { pm?: PackageManager } = {}
): Promise<ToolResult> {
  const { pm } = opts;
  const packageManager = pm ?? (await detectPackageManager(containerId));

  const cmds: Record<PackageManager, string> = {
    npm: "npm ls --depth=0",
    bun: "bun pm ls",
    pnpm: "pnpm ls --depth=0",
    yarn: "yarn list --depth=0",
    pip: "pip list",
  };

  const result = await execInContainer(containerId, cmds[packageManager], {
    timeoutMs: 15_000,
  });

  return {
    success: result.exitCode === 0,
    output: result.stdout || "No dependencies found",
  };
}
