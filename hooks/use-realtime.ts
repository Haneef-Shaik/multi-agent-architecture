"use client";

import { useRef, useCallback, useEffect, useState } from "react";

interface UseRealtimeOptions {
  /** Channels to subscribe to on connect */
  channels?: string[];
  /** WebSocket URL override */
  wsUrl?: string;
  /** Auto-connect on mount */
  autoConnect?: boolean;
  /** Handler for incoming messages */
  onMessage?: (type: string, data: Record<string, unknown>) => void;
}

interface UseRealtimeReturn {
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  send: (message: Record<string, unknown>) => void;
}

/**
 * Hook for managing a WebSocket connection with channel subscriptions.
 * Used for agent events, file changes, and sandbox status updates.
 */
export function useRealtime(options: UseRealtimeOptions = {}): UseRealtimeReturn {
  const {
    channels = [],
    wsUrl,
    autoConnect = false,
    onMessage,
  } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const getWsUrl = useCallback(() => {
    if (wsUrl) return wsUrl;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/api/ws`;
  }, [wsUrl]);

  const send = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const subscribe = useCallback(
    (channel: string) => {
      send({ type: "subscribe", channel });
    },
    [send]
  );

  const unsubscribe = useCallback(
    (channel: string) => {
      send({ type: "unsubscribe", channel });
    },
    [send]
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Subscribe to initial channels
      for (const channel of channels) {
        ws.send(JSON.stringify({ type: "subscribe", channel }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        onMessageRef.current?.(msg.type, msg);
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };

    ws.onerror = () => {
      setConnected(false);
    };
  }, [getWsUrl, channels]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  // Auto-connect
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    connected,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    send,
  };
}
