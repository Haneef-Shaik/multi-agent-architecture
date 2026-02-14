import { execInContainer } from "@/lib/sandbox/exec";
import type { ToolResult } from "@/types/tool";

const MAX_FILE_SIZE = 500 * 1024; // 500KB read limit

/**
 * Read a file from the sandbox workspace.
 */
export async function readFile(
  containerId: string,
  filePath: string
): Promise<ToolResult> {
  const safePath = sanitizePath(filePath);
  const result = await execInContainer(containerId, `cat "${safePath}"`, {
    timeoutMs: 10_000,
  });

  if (result.exitCode !== 0) {
    return {
      success: false,
      output: result.stderr || `Failed to read file: ${safePath}`,
    };
  }

  if (result.stdout.length > MAX_FILE_SIZE) {
    return {
      success: true,
      output:
        result.stdout.slice(0, MAX_FILE_SIZE) +
        `\n... [truncated: file is ${result.stdout.length} bytes]`,
    };
  }

  return { success: true, output: result.stdout };
}

/**
 * Write content to a file in the sandbox workspace.
 */
export async function writeFile(
  containerId: string,
  filePath: string,
  content: string
): Promise<ToolResult> {
  const safePath = sanitizePath(filePath);

  // Ensure parent directory exists
  const dir = safePath.substring(0, safePath.lastIndexOf("/"));
  if (dir) {
    await execInContainer(containerId, `mkdir -p "${dir}"`, {
      timeoutMs: 5_000,
    });
  }

  // Write via heredoc to handle special characters
  // Use a unique delimiter to avoid collisions with file content
  const delimiter = `__EOF_${Date.now()}__`;
  const cmd = `cat > "${safePath}" << '${delimiter}'\n${content}\n${delimiter}`;

  const result = await execInContainer(containerId, cmd, {
    timeoutMs: 10_000,
  });

  if (result.exitCode !== 0) {
    return {
      success: false,
      output: result.stderr || `Failed to write file: ${safePath}`,
    };
  }

  return {
    success: true,
    output: `File written: ${safePath} (${content.length} bytes)`,
    artifacts: [
      {
        type: "file",
        path: safePath,
        operation: "write",
      },
    ],
  };
}

/**
 * Edit a file by replacing a specific string.
 */
export async function editFile(
  containerId: string,
  filePath: string,
  oldContent: string,
  newContent: string
): Promise<ToolResult> {
  const safePath = sanitizePath(filePath);

  // Read current content
  const current = await readFile(containerId, safePath);
  if (!current.success) return current;

  const fileContent = current.output;
  if (!fileContent.includes(oldContent)) {
    return {
      success: false,
      output: `Could not find the specified text to replace in ${safePath}`,
    };
  }

  const updated = fileContent.replace(oldContent, newContent);
  return writeFile(containerId, safePath, updated);
}

/**
 * Delete a file or directory.
 */
export async function deleteFile(
  containerId: string,
  filePath: string
): Promise<ToolResult> {
  const safePath = sanitizePath(filePath);
  const result = await execInContainer(containerId, `rm -rf "${safePath}"`, {
    timeoutMs: 10_000,
  });

  if (result.exitCode !== 0) {
    return {
      success: false,
      output: result.stderr || `Failed to delete: ${safePath}`,
    };
  }

  return {
    success: true,
    output: `Deleted: ${safePath}`,
    artifacts: [{ type: "file", path: safePath, operation: "delete" }],
  };
}

/**
 * List directory contents.
 */
export async function listDirectory(
  containerId: string,
  dirPath: string,
  opts: { recursive?: boolean; maxDepth?: number } = {}
): Promise<ToolResult> {
  const safePath = sanitizePath(dirPath);
  const { recursive = false, maxDepth = 3 } = opts;

  const cmd = recursive
    ? `find "${safePath}" -maxdepth ${maxDepth} -type f -o -type d | head -500`
    : `ls -la "${safePath}"`;

  const result = await execInContainer(containerId, cmd, {
    timeoutMs: 10_000,
  });

  if (result.exitCode !== 0) {
    return {
      success: false,
      output: result.stderr || `Failed to list directory: ${safePath}`,
    };
  }

  return { success: true, output: result.stdout };
}

/**
 * Get the file tree as JSON.
 */
export async function getFileTree(
  containerId: string,
  rootPath: string = "/workspace",
  maxDepth: number = 4
): Promise<ToolResult> {
  const safePath = sanitizePath(rootPath);

  // Use find to get all files/dirs, then format as a tree
  const cmd = `find "${safePath}" -maxdepth ${maxDepth} -not -path '*/node_modules/*' -not -path '*/.git/objects/*' -not -path '*/.git/refs/*' -not -path '*/__pycache__/*' -not -path '*/.next/*' | sort`;

  const result = await execInContainer(containerId, cmd, {
    timeoutMs: 15_000,
  });

  if (result.exitCode !== 0) {
    return {
      success: false,
      output: result.stderr || `Failed to get file tree: ${safePath}`,
    };
  }

  return { success: true, output: result.stdout };
}

/**
 * Search for files matching a pattern.
 */
export async function searchFiles(
  containerId: string,
  pattern: string,
  opts: { path?: string; type?: "file" | "dir" } = {}
): Promise<ToolResult> {
  const searchPath = sanitizePath(opts.path ?? "/workspace");
  const typeFlag = opts.type === "dir" ? "-type d" : opts.type === "file" ? "-type f" : "";

  const cmd = `find "${searchPath}" ${typeFlag} -name "${pattern}" -not -path '*/node_modules/*' -not -path '*/.git/*' | head -100`;

  const result = await execInContainer(containerId, cmd, {
    timeoutMs: 15_000,
  });

  if (result.exitCode !== 0) {
    return {
      success: false,
      output: result.stderr || `Search failed`,
    };
  }

  return { success: true, output: result.stdout || "No matches found" };
}

/**
 * Search file contents with grep.
 */
export async function grepFiles(
  containerId: string,
  pattern: string,
  opts: { path?: string; include?: string } = {}
): Promise<ToolResult> {
  const searchPath = sanitizePath(opts.path ?? "/workspace");
  const includeFlag = opts.include ? `--include="${opts.include}"` : "";

  const cmd = `grep -rn ${includeFlag} "${pattern}" "${searchPath}" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next | head -100`;

  const result = await execInContainer(containerId, cmd, {
    timeoutMs: 15_000,
  });

  if (result.exitCode !== 0 && result.exitCode !== 1) {
    return {
      success: false,
      output: result.stderr || `Grep failed`,
    };
  }

  return {
    success: true,
    output: result.stdout || "No matches found",
  };
}

/**
 * Move/rename a file.
 */
export async function moveFile(
  containerId: string,
  fromPath: string,
  toPath: string
): Promise<ToolResult> {
  const safeFrom = sanitizePath(fromPath);
  const safeTo = sanitizePath(toPath);

  // Ensure target directory exists
  const dir = safeTo.substring(0, safeTo.lastIndexOf("/"));
  if (dir) {
    await execInContainer(containerId, `mkdir -p "${dir}"`, {
      timeoutMs: 5_000,
    });
  }

  const result = await execInContainer(
    containerId,
    `mv "${safeFrom}" "${safeTo}"`,
    { timeoutMs: 10_000 }
  );

  if (result.exitCode !== 0) {
    return {
      success: false,
      output: result.stderr || `Failed to move ${safeFrom} to ${safeTo}`,
    };
  }

  return {
    success: true,
    output: `Moved: ${safeFrom} → ${safeTo}`,
    artifacts: [
      { type: "file", path: safeFrom, operation: "delete" },
      { type: "file", path: safeTo, operation: "write" },
    ],
  };
}

/**
 * Sanitize and resolve a path to be within /workspace.
 */
function sanitizePath(inputPath: string): string {
  // Remove any path traversal attempts
  let cleaned = inputPath.replace(/\.\./g, "").replace(/\/+/g, "/");

  // If relative, prefix with /workspace
  if (!cleaned.startsWith("/workspace")) {
    cleaned = `/workspace/${cleaned}`.replace(/\/+/g, "/");
  }

  // Reject symlink-based escapes (checked at exec time in container)
  return cleaned;
}
