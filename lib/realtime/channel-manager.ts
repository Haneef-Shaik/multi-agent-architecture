import type { WebSocket } from "ws";
import type { ServerMessage } from "./protocol";
import { serializeServerMessage } from "./protocol";

/**
 * ChannelManager handles pub/sub for WebSocket connections.
 *
 * Channels follow the pattern: `type:id`
 *   - agent:{sessionId}   — agent text stream + events
 *   - terminal:{sandboxId}:{terminalId} — terminal I/O
 *   - files:{sandboxId}   — file change notifications
 *   - sandbox:{sandboxId} — sandbox status changes
 */
class ChannelManager {
  // channel → set of subscribed WebSocket clients
  private channels = new Map<string, Set<WebSocket>>();
  // ws → set of channels it's subscribed to (for cleanup)
  private clientChannels = new Map<WebSocket, Set<string>>();

  /**
   * Subscribe a client to a channel.
   */
  subscribe(ws: WebSocket, channel: string): void {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(ws);

    if (!this.clientChannels.has(ws)) {
      this.clientChannels.set(ws, new Set());
    }
    this.clientChannels.get(ws)!.add(channel);
  }

  /**
   * Unsubscribe a client from a channel.
   */
  unsubscribe(ws: WebSocket, channel: string): void {
    this.channels.get(channel)?.delete(ws);
    if (this.channels.get(channel)?.size === 0) {
      this.channels.delete(channel);
    }
    this.clientChannels.get(ws)?.delete(channel);
  }

  /**
   * Remove a client from all channels (on disconnect).
   */
  removeClient(ws: WebSocket): void {
    const channels = this.clientChannels.get(ws);
    if (channels) {
      for (const channel of channels) {
        this.channels.get(channel)?.delete(ws);
        if (this.channels.get(channel)?.size === 0) {
          this.channels.delete(channel);
        }
      }
    }
    this.clientChannels.delete(ws);
  }

  /**
   * Broadcast a message to all subscribers of a channel.
   */
  broadcast(channel: string, message: ServerMessage): void {
    const subscribers = this.channels.get(channel);
    if (!subscribers) return;

    const data = serializeServerMessage(message);
    for (const ws of subscribers) {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    }
  }

  /**
   * Send a message to a specific client.
   */
  send(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(serializeServerMessage(message));
    }
  }

  /**
   * Get the number of subscribers for a channel.
   */
  subscriberCount(channel: string): number {
    return this.channels.get(channel)?.size ?? 0;
  }

  /**
   * Get all channels a client is subscribed to.
   */
  getClientChannels(ws: WebSocket): string[] {
    return Array.from(this.clientChannels.get(ws) ?? []);
  }
}

// Singleton
export const channelManager = new ChannelManager();
