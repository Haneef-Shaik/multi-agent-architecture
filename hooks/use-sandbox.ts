"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface SandboxInfo {
  sandboxId: string;
  containerId: string;
  status: string;
  ports: Array<{
    containerPort: number;
    hostPort: number;
    protocol: string;
  }>;
  volumePath: string;
  liveStatus: string;
}

interface FileTreeItem {
  path: string;
  name: string;
  type: "file" | "directory";
  children?: FileTreeItem[];
}

/**
 * Hook for managing sandbox state and operations.
 */
export function useSandbox(sandboxId: string | null) {
  const queryClient = useQueryClient();

  // Fetch sandbox info
  const {
    data: sandbox,
    isLoading,
    error,
  } = useQuery<SandboxInfo>({
    queryKey: ["sandbox", sandboxId],
    queryFn: async () => {
      const res = await fetch(`/api/sandbox/${sandboxId}`);
      if (!res.ok) throw new Error("Failed to fetch sandbox");
      return res.json();
    },
    enabled: !!sandboxId,
    refetchInterval: 10_000, // Poll status every 10s
  });

  // Fetch file tree
  const {
    data: fileTree,
    isLoading: isLoadingTree,
    refetch: refetchTree,
  } = useQuery<{ root: string; files: string[] }>({
    queryKey: ["sandbox-files", sandboxId],
    queryFn: async () => {
      const res = await fetch(`/api/sandbox/${sandboxId}/files/tree`);
      if (!res.ok) throw new Error("Failed to fetch file tree");
      return res.json();
    },
    enabled: !!sandboxId && sandbox?.status === "active",
  });

  // Read a file
  const readFile = useCallback(
    async (path: string): Promise<string> => {
      if (!sandboxId) throw new Error("No sandbox");
      const res = await fetch(
        `/api/sandbox/${sandboxId}/files?path=${encodeURIComponent(path)}`
      );
      if (!res.ok) throw new Error("Failed to read file");
      const data = await res.json();
      return data.content;
    },
    [sandboxId]
  );

  // Write a file
  const writeFileMutation = useMutation({
    mutationFn: async ({
      path,
      content,
    }: {
      path: string;
      content: string;
    }) => {
      const res = await fetch(`/api/sandbox/${sandboxId}/files`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content }),
      });
      if (!res.ok) throw new Error("Failed to write file");
      return res.json();
    },
    onSuccess: () => {
      refetchTree();
    },
  });

  // Execute a command
  const execMutation = useMutation({
    mutationFn: async (command: string) => {
      const res = await fetch(`/api/sandbox/${sandboxId}/exec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      if (!res.ok) throw new Error("Failed to execute command");
      return res.json();
    },
  });

  // Hibernate
  const hibernateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sandbox/${sandboxId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hibernate" }),
      });
      if (!res.ok) throw new Error("Failed to hibernate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sandbox", sandboxId] });
    },
  });

  // Resume
  const resumeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sandbox/${sandboxId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      if (!res.ok) throw new Error("Failed to resume");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sandbox", sandboxId] });
    },
  });

  // Terminate
  const terminateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sandbox/${sandboxId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to terminate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sandbox", sandboxId] });
    },
  });

  // Parse flat file list into a tree structure
  const parsedTree = fileTree
    ? buildFileTree(fileTree.files, fileTree.root)
    : [];

  return {
    sandbox,
    isLoading,
    error,
    fileTree: parsedTree,
    isLoadingTree,
    refetchTree,
    readFile,
    writeFile: writeFileMutation.mutateAsync,
    exec: execMutation.mutateAsync,
    hibernate: hibernateMutation.mutateAsync,
    resume: resumeMutation.mutateAsync,
    terminate: terminateMutation.mutateAsync,
    isWriting: writeFileMutation.isPending,
    isExecing: execMutation.isPending,
  };
}

/**
 * Convert a flat list of file paths into a nested tree.
 */
function buildFileTree(paths: string[], root: string): FileTreeItem[] {
  const tree: FileTreeItem[] = [];
  const map = new Map<string, FileTreeItem>();

  for (const fullPath of paths) {
    // Make relative to root
    const relativePath = fullPath.startsWith(root)
      ? fullPath.slice(root.length).replace(/^\//, "")
      : fullPath;

    if (!relativePath) continue;

    const parts = relativePath.split("/");
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!map.has(currentPath)) {
        const isFile = i === parts.length - 1 && !fullPath.endsWith("/");
        const item: FileTreeItem = {
          path: `${root}/${currentPath}`,
          name: part,
          type: isFile ? "file" : "directory",
          children: isFile ? undefined : [],
        };
        map.set(currentPath, item);

        if (parentPath) {
          const parent = map.get(parentPath);
          parent?.children?.push(item);
        } else {
          tree.push(item);
        }
      }
    }
  }

  // Sort: directories first, then alphabetical
  const sortTree = (items: FileTreeItem[]) => {
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const item of items) {
      if (item.children) sortTree(item.children);
    }
  };
  sortTree(tree);

  return tree;
}
