"use client";

import { useEffect, useCallback, useState } from "react";
import { useTerminal } from "@/hooks/use-terminal";

interface TerminalPanelProps {
  sandboxId: string;
  terminalId?: string;
  className?: string;
}

export function TerminalPanel({
  sandboxId,
  terminalId: externalTerminalId,
  className = "",
}: TerminalPanelProps) {
  const [terminalId] = useState(
    () => externalTerminalId ?? `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  const { containerRef, connected, connect, disconnect } = useTerminal({
    sandboxId,
    terminalId,
  });

  // Create terminal session on the server, then connect
  const initTerminal = useCallback(async () => {
    try {
      const res = await fetch(`/api/sandbox/${sandboxId}/terminal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cols: 120, rows: 30 }),
      });

      if (!res.ok) {
        console.error("Failed to create terminal session");
        return;
      }

      connect();
    } catch (err) {
      console.error("Terminal init failed:", err);
    }
  }, [sandboxId, connect]);

  useEffect(() => {
    initTerminal();
    return () => {
      disconnect();
    };
  }, [initTerminal, disconnect]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Terminal header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--panel)] border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-green-500" : "bg-neutral-500"
            }`}
          />
          <span className="text-xs text-[var(--muted-foreground)]">
            Terminal
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              disconnect();
              setTimeout(initTerminal, 200);
            }}
            className="text-xs px-2 py-0.5 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
          >
            Restart
          </button>
        </div>
      </div>

      {/* Terminal container */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0"
        style={{ backgroundColor: "#0a0a0a" }}
      />
    </div>
  );
}
