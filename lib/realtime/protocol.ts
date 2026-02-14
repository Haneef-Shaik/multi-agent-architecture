/**
 * WebSocket message protocol definitions.
 * All messages are JSON-encoded with a `type` field.
 */

// --- Client → Server Messages ---

export type ClientMessage =
  | TerminalInputMessage
  | TerminalResizeMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | PingMessage;

export interface TerminalInputMessage {
  type: "terminal:input";
  terminalId: string;
  data: string; // raw terminal input
}

export interface TerminalResizeMessage {
  type: "terminal:resize";
  terminalId: string;
  cols: number;
  rows: number;
}

export interface SubscribeMessage {
  type: "subscribe";
  channel: string; // e.g., "agent:session-123", "files:sandbox-456"
}

export interface UnsubscribeMessage {
  type: "unsubscribe";
  channel: string;
}

export interface PingMessage {
  type: "ping";
}

// --- Server → Client Messages ---

export type ServerMessage =
  | TerminalOutputMessage
  | TerminalExitMessage
  | AgentStreamMessage
  | AgentEventMessage
  | FileChangeMessage
  | SandboxStatusMessage
  | ErrorMessage
  | PongMessage;

export interface TerminalOutputMessage {
  type: "terminal:output";
  terminalId: string;
  data: string; // raw terminal output
}

export interface TerminalExitMessage {
  type: "terminal:exit";
  terminalId: string;
  exitCode: number;
}

export interface AgentStreamMessage {
  type: "agent:text";
  sessionId: string;
  delta: string;
}

export interface AgentEventMessage {
  type: "agent:event";
  sessionId: string;
  event: string;
  data: unknown;
}

export interface FileChangeMessage {
  type: "file:change";
  sandboxId: string;
  path: string;
  changeType: "create" | "modify" | "delete";
}

export interface SandboxStatusMessage {
  type: "sandbox:status";
  sandboxId: string;
  status: string;
}

export interface ErrorMessage {
  type: "error";
  message: string;
  code?: string;
}

export interface PongMessage {
  type: "pong";
}

// --- Helpers ---

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const msg = JSON.parse(raw);
    if (typeof msg.type !== "string") return null;
    return msg as ClientMessage;
  } catch {
    return null;
  }
}

export function serializeServerMessage(msg: ServerMessage): string {
  return JSON.stringify(msg);
}
