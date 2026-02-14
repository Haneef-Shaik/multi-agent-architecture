"use client";

import { useState, useCallback, useRef } from "react";

interface UseAgentStreamOptions {
  onText?: (delta: string) => void;
  onEvent?: (event: string, data: Record<string, unknown>) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

export function useAgentStream(options: UseAgentStreamOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const sendMessage = useCallback(
    async (
      sessionId: string,
      message: string,
      opts?: { containerId?: string; model?: string }
    ) => {
      setIsStreaming(true);
      setStreamedText("");
      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/agent/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            message,
            containerId: opts?.containerId,
            model: opts?.model,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Agent execution failed");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let currentEvent = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7);
            } else if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                // Always forward to the event handler
                optionsRef.current.onEvent?.(currentEvent, data);

                if (currentEvent === "agent.text" && data.delta) {
                  setStreamedText((prev) => prev + data.delta);
                  optionsRef.current.onText?.(data.delta);
                } else if (currentEvent === "done") {
                  optionsRef.current.onDone?.();
                } else if (currentEvent === "error") {
                  optionsRef.current.onError?.(data.message);
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          optionsRef.current.onError?.(
            error instanceof Error ? error.message : String(error)
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    []
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    sendMessage,
    cancel,
    isStreaming,
    streamedText,
    setStreamedText,
  };
}
