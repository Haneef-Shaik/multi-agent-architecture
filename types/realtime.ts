export type WSMessageType =
  | "agent.stream"
  | "agent.tool_call"
  | "agent.tool_result"
  | "agent.status"
  | "terminal.output"
  | "terminal.input"
  | "file.changed"
  | "file.created"
  | "file.deleted"
  | "preview.reload"
  | "sandbox.status"
  | "error";

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  channel: string;
  payload: T;
  timestamp: number;
  seq: number;
}

export interface AgentStreamPayload {
  delta: string;
  agentId: string;
  taskId: string;
}

export interface AgentToolCallPayload {
  tool: string;
  args: Record<string, unknown>;
  agentId: string;
  taskId: string;
}

export interface AgentToolResultPayload {
  tool: string;
  result: unknown;
  error?: string;
  duration: number;
  agentId: string;
  taskId: string;
}

export interface AgentStatusPayload {
  agentId: string;
  taskId: string;
  status: "started" | "completed" | "failed";
  skillsLoaded?: string[];
}

export interface FileChangePayload {
  path: string;
  type: "modified" | "created" | "deleted" | "renamed";
  oldPath?: string;
}

export interface SandboxStatusPayload {
  sandboxId: string;
  status: "provisioning" | "ready" | "active" | "hibernating" | "terminated";
}
