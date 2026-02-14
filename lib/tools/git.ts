import { execInContainer } from "@/lib/sandbox/exec";
import type { ToolResult } from "@/types/tool";

const GIT_TIMEOUT = 30_000; // 30 seconds

/**
 * Initialize a git repository in the workspace.
 */
export async function gitInit(containerId: string): Promise<ToolResult> {
  const result = await execInContainer(
    containerId,
    'git init && git config user.email "agent@superagent.dev" && git config user.name "SuperAgent"',
    { timeoutMs: GIT_TIMEOUT }
  );

  return {
    success: result.exitCode === 0,
    output: result.stdout || result.stderr,
  };
}

/**
 * Stage and commit changes.
 */
export async function gitCommit(
  containerId: string,
  message: string,
  opts: { addAll?: boolean; files?: string[] } = {}
): Promise<ToolResult> {
  const { addAll = true, files = [] } = opts;

  // Stage files
  const addCmd = addAll
    ? "git add -A"
    : `git add ${files.map((f) => `"${f}"`).join(" ")}`;

  const stageResult = await execInContainer(containerId, addCmd, {
    timeoutMs: GIT_TIMEOUT,
  });

  if (stageResult.exitCode !== 0) {
    return {
      success: false,
      output: `Failed to stage files: ${stageResult.stderr}`,
    };
  }

  // Commit
  const safeMessage = message.replace(/"/g, '\\"');
  const commitResult = await execInContainer(
    containerId,
    `git commit -m "${safeMessage}"`,
    { timeoutMs: GIT_TIMEOUT }
  );

  if (commitResult.exitCode !== 0) {
    // Check if there's nothing to commit
    if (commitResult.stdout.includes("nothing to commit")) {
      return { success: true, output: "Nothing to commit" };
    }
    return {
      success: false,
      output: commitResult.stderr || commitResult.stdout,
    };
  }

  return {
    success: true,
    output: commitResult.stdout,
  };
}

/**
 * Get git diff (staged + unstaged).
 */
export async function gitDiff(
  containerId: string,
  opts: { staged?: boolean; file?: string } = {}
): Promise<ToolResult> {
  const { staged = false, file } = opts;
  const stagedFlag = staged ? "--staged" : "";
  const fileArg = file ? `-- "${file}"` : "";

  const result = await execInContainer(
    containerId,
    `git diff ${stagedFlag} ${fileArg}`,
    { timeoutMs: GIT_TIMEOUT }
  );

  return {
    success: result.exitCode === 0,
    output: result.stdout || "(no diff)",
  };
}

/**
 * Get git log.
 */
export async function gitLog(
  containerId: string,
  opts: { limit?: number; oneline?: boolean } = {}
): Promise<ToolResult> {
  const { limit = 20, oneline = true } = opts;
  const format = oneline ? "--oneline" : "--format=medium";

  const result = await execInContainer(
    containerId,
    `git log ${format} -n ${limit}`,
    { timeoutMs: GIT_TIMEOUT }
  );

  if (result.exitCode !== 0) {
    return {
      success: false,
      output: result.stderr || "No commits yet",
    };
  }

  return {
    success: true,
    output: result.stdout || "No commits found",
  };
}

/**
 * Get git status.
 */
export async function gitStatus(containerId: string): Promise<ToolResult> {
  const result = await execInContainer(containerId, "git status --short", {
    timeoutMs: GIT_TIMEOUT,
  });

  return {
    success: result.exitCode === 0,
    output: result.stdout || "Working tree clean",
  };
}

/**
 * Create or switch branches.
 */
export async function gitBranch(
  containerId: string,
  branchName: string,
  opts: { create?: boolean } = {}
): Promise<ToolResult> {
  const { create = false } = opts;
  const cmd = create
    ? `git checkout -b "${branchName}"`
    : `git checkout "${branchName}"`;

  const result = await execInContainer(containerId, cmd, {
    timeoutMs: GIT_TIMEOUT,
  });

  return {
    success: result.exitCode === 0,
    output: result.stdout || result.stderr,
  };
}

/**
 * List branches.
 */
export async function gitListBranches(
  containerId: string
): Promise<ToolResult> {
  const result = await execInContainer(containerId, "git branch -a", {
    timeoutMs: GIT_TIMEOUT,
  });

  return {
    success: result.exitCode === 0,
    output: result.stdout || "No branches",
  };
}
