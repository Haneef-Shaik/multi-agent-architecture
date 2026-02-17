import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import { channelManager } from "./channel-manager";
import { parseClientMessage } from "./protocol";
import { startInteractiveShell, resizeShell } from "@/lib/sandbox/exec";
import { sandboxManager } from "@/lib/sandbox/manager";

// Active terminal sessions: terminalId → { stream, execId }
const terminalSessions = new Map<
  string,
  {
    stream: Duplex;
    execId: string;
    containerId: string;
    ws: WebSocket;
  }
>();

let wss: WebSocketServer | null = null;

/**
 * Initialize the WebSocket server.
 * Called once during server startup.
 */
export function getOrCreateWSS(): WebSocketServer {
  if (wss) return wss;

  wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    // Set up ping/pong for keepalive
    const pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      }
    }, 30_000);

    ws.on("message", async (raw) => {
      const msg = parseClientMessage(raw.toString());
      if (!msg) return;

      switch (msg.type) {
        case "ping":
          channelManager.send(ws, { type: "pong" });
          break;

        case "subscribe": {
          channelManager.subscribe(ws, msg.channel);

          // Auto-create terminal session when subscribing to a terminal channel
          const terminalMatch = msg.channel.match(
            /^terminal:([^:]+):([^:]+)$/
          );
          if (terminalMatch) {
            const [, sandboxId, terminalId] = terminalMatch;
            // Only create if not already active
            if (!terminalSessions.has(terminalId)) {
              await createTerminalSession(ws, terminalId, sandboxId);
            }
          }
          break;
        }

        case "unsubscribe":
          channelManager.unsubscribe(ws, msg.channel);
          break;

        case "terminal:input":
          await handleTerminalInput(ws, msg.terminalId, msg.data);
          break;

        case "terminal:resize":
          await handleTerminalResize(msg.terminalId, msg.cols, msg.rows);
          break;
      }
    });

    ws.on("close", () => {
      clearInterval(pingInterval);
      // Clean up terminal sessions owned by this client
      for (const [termId, session] of terminalSessions.entries()) {
        if (session.ws === ws) {
          session.stream.destroy();
          terminalSessions.delete(termId);
        }
      }
      channelManager.removeClient(ws);
    });

    ws.on("error", () => {
      clearInterval(pingInterval);
      channelManager.removeClient(ws);
    });
  });

  return wss;
}

/**
 * Handle the HTTP upgrade request for WebSocket.
 */
export function handleUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer
): void {
  const server = getOrCreateWSS();
  server.handleUpgrade(req, socket, head, (ws) => {
    server.emit("connection", ws, req);
  });
}

/**
 * Create a terminal session bound to a WebSocket client.
 */
export async function createTerminalSession(
  ws: WebSocket,
  terminalId: string,
  sandboxId: string,
  opts: { cols?: number; rows?: number } = {}
): Promise<void> {
  const containerId = await sandboxManager.resolveContainerId(sandboxId);
  if (!containerId) {
    channelManager.send(ws, {
      type: "error",
      message: "Sandbox container not found",
      code: "SANDBOX_NOT_FOUND",
    });
    return;
  }

  try {
    const { exec, stream } = await startInteractiveShell(containerId, opts);

    terminalSessions.set(terminalId, {
      stream,
      execId: exec.id,
      containerId,
      ws,
    });

    // Forward container output to the WebSocket client
    stream.on("data", (chunk: Buffer) => {
      channelManager.send(ws, {
        type: "terminal:output",
        terminalId,
        data: chunk.toString("utf-8"),
      });
    });

    stream.on("end", () => {
      channelManager.send(ws, {
        type: "terminal:exit",
        terminalId,
        exitCode: 0,
      });
      terminalSessions.delete(terminalId);
    });

    // Subscribe to the terminal channel
    channelManager.subscribe(ws, `terminal:${sandboxId}:${terminalId}`);
  } catch (error) {
    channelManager.send(ws, {
      type: "error",
      message:
        error instanceof Error ? error.message : "Failed to create terminal",
      code: "TERMINAL_CREATE_FAILED",
    });
  }
}

/**
 * Handle terminal input from a WebSocket client.
 */
async function handleTerminalInput(
  ws: WebSocket,
  terminalId: string,
  data: string
): Promise<void> {
  const session = terminalSessions.get(terminalId);
  if (!session || session.ws !== ws) {
    channelManager.send(ws, {
      type: "error",
      message: "Terminal session not found",
      code: "TERMINAL_NOT_FOUND",
    });
    return;
  }

  session.stream.write(data);
}

/**
 * Handle terminal resize.
 */
async function handleTerminalResize(
  terminalId: string,
  cols: number,
  rows: number
): Promise<void> {
  const session = terminalSessions.get(terminalId);
  if (!session) return;

  try {
    await resizeShell(session.execId, cols, rows);
  } catch {
    // Resize failures are non-critical
  }
}

/**
 * Broadcast an agent event to all subscribers of a session channel.
 */
export function broadcastAgentEvent(
  sessionId: string,
  event: string,
  data: unknown
): void {
  channelManager.broadcast(`agent:${sessionId}`, {
    type: "agent:event",
    sessionId,
    event,
    data,
  });
}

/**
 * Broadcast agent text stream to subscribers.
 */
export function broadcastAgentText(sessionId: string, delta: string): void {
  channelManager.broadcast(`agent:${sessionId}`, {
    type: "agent:text",
    sessionId,
    delta,
  });
}

/**
 * Broadcast file change notification.
 */
export function broadcastFileChange(
  sandboxId: string,
  path: string,
  changeType: "create" | "modify" | "delete"
): void {
  channelManager.broadcast(`files:${sandboxId}`, {
    type: "file:change",
    sandboxId,
    path,
    changeType,
  });
}
