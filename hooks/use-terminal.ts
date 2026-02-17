"use client";

import { useRef, useCallback, useEffect, useState } from "react";

interface UseTerminalOptions {
  sandboxId: string;
  terminalId: string;
  wsUrl?: string;
}

interface UseTerminalReturn {
  /** Ref to attach to the terminal container div */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Whether the terminal is connected */
  connected: boolean;
  /** Send input to the terminal */
  write: (data: string) => void;
  /** Resize the terminal */
  resize: (cols: number, rows: number) => void;
  /** Connect to the terminal */
  connect: () => void;
  /** Disconnect from the terminal */
  disconnect: () => void;
}

/**
 * Hook that manages an xterm.js terminal connected via WebSocket.
 * Lazily loads xterm.js to avoid SSR issues.
 */
export function useTerminal(options: UseTerminalOptions): UseTerminalReturn {
  const { sandboxId, terminalId, wsUrl } = options;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<InstanceType<
    typeof import("@xterm/xterm").Terminal
  > | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<InstanceType<
    typeof import("@xterm/addon-fit").FitAddon
  > | null>(null);
  const [connected, setConnected] = useState(false);

  const getWsUrl = useCallback(() => {
    if (wsUrl) return wsUrl;
    // WS server runs on a separate port (default 3001)
    const wsPort = process.env.NEXT_PUBLIC_WS_PORT ?? "3001";
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.hostname}:${wsPort}/api/ws`;
  }, [wsUrl]);

  const write = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "terminal:input",
          terminalId,
          data,
        })
      );
    }
  }, [terminalId]);

  const resize = useCallback(
    (cols: number, rows: number) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "terminal:resize",
            terminalId,
            cols,
            rows,
          })
        );
      }
    },
    [terminalId]
  );

  const connect = useCallback(async () => {
    if (!containerRef.current) return;

    // Dynamically import xterm to avoid SSR issues
    const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
      import("@xterm/addon-web-links"),
    ]);

    // Create terminal instance
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      theme: {
        background: "#0a0a0a",
        foreground: "#e0e0e0",
        cursor: "#f0f0f0",
        selectionBackground: "#3a3a5c",
        black: "#1a1a2e",
        red: "#ff6b6b",
        green: "#51cf66",
        yellow: "#ffd43b",
        blue: "#5c7cfa",
        magenta: "#cc5de8",
        cyan: "#22b8cf",
        white: "#e0e0e0",
        brightBlack: "#495057",
        brightRed: "#ff8787",
        brightGreen: "#69db7c",
        brightYellow: "#ffe066",
        brightBlue: "#748ffc",
        brightMagenta: "#da77f2",
        brightCyan: "#3bc9db",
        brightWhite: "#f8f9fa",
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect WebSocket
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Subscribe to terminal channel
      ws.send(
        JSON.stringify({
          type: "subscribe",
          channel: `terminal:${sandboxId}:${terminalId}`,
        })
      );
      // Send initial size
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        resize(dims.cols, dims.rows);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "terminal:output" && msg.terminalId === terminalId) {
          term.write(msg.data);
        } else if (
          msg.type === "terminal:exit" &&
          msg.terminalId === terminalId
        ) {
          term.write("\r\n\x1b[33m[Process exited]\x1b[0m\r\n");
          setConnected(false);
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    // Forward terminal input to WebSocket
    term.onData((data) => {
      write(data);
    });

    // Handle terminal resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        resize(dims.cols, dims.rows);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [sandboxId, terminalId, getWsUrl, write, resize]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    termRef.current?.dispose();
    termRef.current = null;
    wsRef.current = null;
    fitAddonRef.current = null;
    setConnected(false);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    containerRef,
    connected,
    write,
    resize,
    connect,
    disconnect,
  };
}
