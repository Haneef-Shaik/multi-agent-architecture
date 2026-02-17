/**
 * Standalone Bun-native WebSocket server for terminal sessions.
 *
 * Runs alongside Next.js on a separate port (default 3001).
 * Uses Bun's built-in WebSocket support instead of the `ws` library,
 * which is incompatible with Bun's HTTP upgrade handling.
 *
 * Start with: bun run server.ts
 */
import type { ServerWebSocket } from "bun";
import type { Duplex } from "stream";
import { startInteractiveShell, resizeShell } from "@/lib/sandbox/exec";
import { sandboxManager } from "@/lib/sandbox/manager";

const WS_PORT = parseInt(process.env.WS_PORT ?? "3001", 10);

interface WSData {
  id: string;
}

// Active terminal sessions: terminalId → session info
const terminalSessions = new Map<
  string,
  {
    stream: Duplex;
    execId: string;
    containerId: string;
    ws: ServerWebSocket<WSData>;
  }
>();

// Track which WebSocket owns which terminals (for cleanup)
const wsTerminals = new Map<ServerWebSocket<WSData>, Set<string>>();

Bun.serve<WSData>({
  port: WS_PORT,

  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/api/ws") {
      const id = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const upgraded = server.upgrade(req, { data: { id } });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    return new Response("WebSocket server running", { status: 200 });
  },

  websocket: {
    open(ws) {
      wsTerminals.set(ws, new Set());
    },

    async message(ws, message) {
      const raw =
        typeof message === "string"
          ? message
          : new TextDecoder().decode(message);

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      switch (msg.type) {
        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;

        case "subscribe": {
          const channel = msg.channel as string | undefined;
          if (!channel) break;

          // Auto-create terminal session when subscribing to terminal channel
          const match = channel.match(/^terminal:([^:]+):([^:]+)$/);
          if (match) {
            const [, sandboxId, terminalId] = match;
            if (!terminalSessions.has(terminalId)) {
              await createTerminal(ws, terminalId, sandboxId);
            }
          }
          break;
        }

        case "terminal:input": {
          const terminalId = msg.terminalId as string;
          const data = msg.data as string;
          const session = terminalSessions.get(terminalId);
          if (session && session.ws === ws) {
            session.stream.write(data);
          }
          break;
        }

        case "terminal:resize": {
          const terminalId = msg.terminalId as string;
          const session = terminalSessions.get(terminalId);
          if (session) {
            try {
              await resizeShell(
                session.execId,
                msg.cols as number,
                msg.rows as number
              );
            } catch {
              // Resize failures are non-critical
            }
          }
          break;
        }
      }
    },

    close(ws) {
      // Clean up terminal sessions owned by this client
      const terminals = wsTerminals.get(ws);
      if (terminals) {
        for (const terminalId of terminals) {
          const session = terminalSessions.get(terminalId);
          if (session) {
            session.stream.destroy();
            terminalSessions.delete(terminalId);
          }
        }
      }
      wsTerminals.delete(ws);
    },
  },
});

async function createTerminal(
  ws: ServerWebSocket<WSData>,
  terminalId: string,
  sandboxId: string
): Promise<void> {
  const containerId = await sandboxManager.resolveContainerId(sandboxId);
  if (!containerId) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Sandbox container not found",
        code: "SANDBOX_NOT_FOUND",
      })
    );
    return;
  }

  try {
    const { exec, stream } = await startInteractiveShell(containerId);

    terminalSessions.set(terminalId, {
      stream,
      execId: exec.id,
      containerId,
      ws,
    });

    // Track ownership for cleanup
    wsTerminals.get(ws)?.add(terminalId);

    // Forward container output to WebSocket client
    stream.on("data", (chunk: Buffer) => {
      ws.send(
        JSON.stringify({
          type: "terminal:output",
          terminalId,
          data: chunk.toString("utf-8"),
        })
      );
    });

    stream.on("end", () => {
      ws.send(
        JSON.stringify({
          type: "terminal:exit",
          terminalId,
          exitCode: 0,
        })
      );
      terminalSessions.delete(terminalId);
      wsTerminals.get(ws)?.delete(terminalId);
    });
  } catch (error) {
    ws.send(
      JSON.stringify({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to create terminal",
        code: "TERMINAL_CREATE_FAILED",
      })
    );
  }
}

console.log(`> WebSocket server listening on ws://localhost:${WS_PORT}/api/ws`);
