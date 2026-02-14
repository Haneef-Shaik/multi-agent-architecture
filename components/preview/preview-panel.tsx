"use client";

import { useState, useCallback, useRef } from "react";

interface PreviewPort {
  containerPort: number;
  hostPort: number;
  label?: string;
}

interface PreviewPanelProps {
  sandboxId: string;
  ports: PreviewPort[];
  className?: string;
}

export function PreviewPanel({
  sandboxId,
  ports,
  className = "",
}: PreviewPanelProps) {
  const [activePort, setActivePort] = useState<number>(
    ports[0]?.containerPort ?? 3000
  );
  const [customUrl, setCustomUrl] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const previewUrl = `/api/preview/${sandboxId}/${activePort}/${customUrl}`;

  const handleRefresh = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = previewUrl;
    }
  }, [previewUrl]);

  const handleUrlChange = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const input = e.currentTarget.value.trim();
        // Strip leading slash
        setCustomUrl(input.startsWith("/") ? input.slice(1) : input);
      }
    },
    []
  );

  if (ports.length === 0) {
    return (
      <div
        className={`flex items-center justify-center h-full bg-[var(--panel)] text-[var(--muted-foreground)] ${className}`}
      >
        <div className="text-center">
          <div className="text-4xl mb-2 opacity-30">🖥️</div>
          <p className="text-sm">No preview available</p>
          <p className="text-xs mt-1 opacity-60">
            Start a dev server to see the preview
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 bg-[var(--panel)] border-b border-[var(--border)]">
        {/* Port tabs */}
        <div className="flex items-center gap-0.5 mr-2">
          {ports.map((port) => (
            <button
              key={port.containerPort}
              onClick={() => setActivePort(port.containerPort)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                activePort === port.containerPort
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              {port.label ?? `:${port.containerPort}`}
            </button>
          ))}
        </div>

        {/* URL bar */}
        <div className="flex-1 flex items-center gap-1">
          <button
            onClick={handleRefresh}
            className="p-1 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
            title="Refresh"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M1.5 7a5.5 5.5 0 1 1 1.12 3.33" />
              <path d="M1.5 11V7h4" />
            </svg>
          </button>
          <input
            type="text"
            defaultValue={`/${customUrl}`}
            onKeyDown={handleUrlChange}
            placeholder="/"
            className="flex-1 text-xs px-2 py-1 bg-[var(--muted)] rounded border border-transparent focus:border-[var(--ring)] focus:outline-none text-[var(--foreground)]"
          />
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener"
            className="p-1 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
            title="Open in new tab"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M10 1.5h2.5V4M12.5 1.5L7 7M5.5 1.5H2a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V8.5" />
            </svg>
          </a>
        </div>
      </div>

      {/* iframe */}
      <div className="flex-1 min-h-0 bg-white">
        <iframe
          ref={iframeRef}
          src={previewUrl}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          title="Preview"
        />
      </div>
    </div>
  );
}
