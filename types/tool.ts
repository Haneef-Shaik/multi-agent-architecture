export interface ToolContext {
  sandboxId: string;
  userId: string;
  projectId: string;
  abortSignal: AbortSignal;
}

export interface ToolResult {
  success: boolean;
  output: string;
  artifacts?: ToolArtifact[];
  error?: string;
  exitCode?: number;
}

export interface ToolArtifact {
  type: "file" | "image" | "url";
  path?: string;
  content?: string;
  url?: string;
  operation?: "write" | "delete" | "move";
}
