"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Square, Bot, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { ModelSelector } from "./model-selector";
import {
  ToolCallDisplay,
  type ToolCallInfo,
} from "@/components/agents/tool-call-display";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallInfo[];
  tokensUsed?: { input: number; output: number };
}

interface ChatPanelProps {
  sessionId: string;
  containerId?: string;
  onEvent?: (event: string, data: Record<string, unknown>) => void;
}

export function ChatPanel({
  sessionId,
  containerId,
  onEvent,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedModel, setSelectedModel] = useState(
    "anthropic/claude-sonnet-4-20250514"
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Refs for accumulating streaming metadata
  const streamToolCallsRef = useRef<ToolCallInfo[]>([]);
  const streamTokensRef = useRef<{ input: number; output: number } | null>(
    null
  );

  // Wrap onEvent to intercept tool call and usage events
  const handleEvent = useCallback(
    (event: string, data: Record<string, unknown>) => {
      if (event === "agent.tool_call") {
        const tc: ToolCallInfo = {
          id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          toolName: String(data.tool ?? ""),
          args: (data.args as Record<string, unknown>) ?? {},
          status: "running",
          timestamp: Date.now(),
        };
        streamToolCallsRef.current = [...streamToolCallsRef.current, tc];

        // Update the streaming message with current tool calls
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === "streaming");
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              toolCalls: [...streamToolCallsRef.current],
            };
            return updated;
          }
          return prev;
        });
      } else if (event === "agent.tool_result") {
        const toolName = String(data.tool ?? "");
        // Find the last running tool call with this name
        const calls = [...streamToolCallsRef.current];
        for (let i = calls.length - 1; i >= 0; i--) {
          if (calls[i].toolName === toolName && calls[i].status === "running") {
            calls[i] = {
              ...calls[i],
              result: String(data.result ?? ""),
              status: "completed",
              duration: Date.now() - calls[i].timestamp,
            };
            break;
          }
        }
        streamToolCallsRef.current = calls;

        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === "streaming");
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              toolCalls: [...streamToolCallsRef.current],
            };
            return updated;
          }
          return prev;
        });
      } else if (event === "supervisor.usage") {
        const tokensUsed = data.tokensUsed as
          | { input: number; output: number }
          | undefined;
        if (tokensUsed) {
          streamTokensRef.current = tokensUsed;
        }
      }

      // Forward to parent handler
      onEvent?.(event, data);
    },
    [onEvent]
  );

  const { sendMessage, cancel, isStreaming, streamedText, setStreamedText } =
    useAgentStream({
      onEvent: handleEvent,
      onDone() {
        // Finalize the assistant message with accumulated metadata
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.id === "streaming") {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                id: `msg-${Date.now()}`,
                toolCalls:
                  streamToolCallsRef.current.length > 0
                    ? [...streamToolCallsRef.current]
                    : undefined,
                tokensUsed: streamTokensRef.current ?? undefined,
              },
            ];
          }
          return prev;
        });
        // Reset refs for next message
        streamToolCallsRef.current = [];
        streamTokensRef.current = null;
        setStreamedText("");
      },
      onError(error) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== "streaming"),
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `Error: ${error}`,
          },
        ]);
        streamToolCallsRef.current = [];
        streamTokensRef.current = null;
        setStreamedText("");
      },
    });

  // Fetch message history when sessionId changes
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    setIsLoadingHistory(true);
    setMessages([]);

    fetch(`/api/sessions/${sessionId}/messages?limit=100`)
      .then((res) => (res.ok ? res.json() : []))
      .then(
        (
          dbMessages: Array<{
            _id: string;
            role: string;
            content: string;
            metadata?: {
              tokensUsed?: { input: number; output: number };
              toolCalls?: Array<{
                tool: string;
                args: Record<string, unknown>;
                result?: string;
              }>;
            };
          }>
        ) => {
          if (cancelled) return;
          const mapped: ChatMessage[] = dbMessages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => {
              const msg: ChatMessage = {
                id: m._id ?? `msg-${Date.now()}-${Math.random()}`,
                role: m.role as "user" | "assistant",
                content: m.content,
              };
              if (m.metadata?.tokensUsed) {
                msg.tokensUsed = m.metadata.tokensUsed;
              }
              if (m.metadata?.toolCalls && m.metadata.toolCalls.length > 0) {
                msg.toolCalls = m.metadata.toolCalls.map((tc, i) => ({
                  id: `hist-tc-${i}`,
                  toolName: tc.tool,
                  args: tc.args,
                  result: tc.result,
                  status: "completed" as const,
                  timestamp: Date.now(),
                }));
              }
              return msg;
            });
          setMessages(mapped);
        }
      )
      .catch(() => {
        // Silently fail — empty chat is fine
      })
      .finally(() => {
        if (!cancelled) setIsLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Update streaming message in real-time
  useEffect(() => {
    if (isStreaming && streamedText) {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === "streaming");
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], content: streamedText };
          return updated;
        }
        return [
          ...prev,
          {
            id: "streaming",
            role: "assistant",
            content: streamedText,
            toolCalls:
              streamToolCallsRef.current.length > 0
                ? [...streamToolCallsRef.current]
                : undefined,
          },
        ];
      });
    }
  }, [isStreaming, streamedText]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    // Reset streaming refs
    streamToolCallsRef.current = [];
    streamTokensRef.current = null;

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Start agent execution
    sendMessage(sessionId, text, { containerId, model: selectedModel });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoadingHistory && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
            <span className="ml-2 text-sm text-[var(--muted-foreground)]">
              Loading messages...
            </span>
          </div>
        )}

        {!isLoadingHistory && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="h-10 w-10 text-[var(--muted-foreground)] mb-3" />
            <h3 className="font-semibold mb-1">Start building</h3>
            <p className="text-sm text-[var(--muted-foreground)] max-w-xs">
              Describe what you want to build and the AI agents will plan and
              implement it for you.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "assistant" && (
              <div className="shrink-0 h-7 w-7 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 text-[var(--accent)]" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "bg-[var(--muted)]"
              }`}
            >
              {/* Tool calls (shown before text for assistant messages) */}
              {msg.role === "assistant" &&
                msg.toolCalls &&
                msg.toolCalls.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {msg.toolCalls.map((tc) => (
                      <ToolCallDisplay key={tc.id} toolCall={tc} />
                    ))}
                  </div>
                )}

              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.id === "streaming" && (
                <span className="inline-block w-1.5 h-4 bg-[var(--accent)] animate-pulse ml-0.5" />
              )}

              {/* Token usage badge */}
              {msg.role === "assistant" && msg.tokensUsed && (
                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[var(--muted-foreground)]">
                  <span title="Input tokens">
                    {msg.tokensUsed.input.toLocaleString()} in
                  </span>
                  <span title="Output tokens">
                    {msg.tokensUsed.output.toLocaleString()} out
                  </span>
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="shrink-0 h-7 w-7 rounded-full bg-[var(--primary)] flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-[var(--primary-foreground)]" />
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[var(--border)] px-4 py-3">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Describe what you want to build..."
              rows={1}
              className="flex-1 resize-none rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              style={{ minHeight: "38px", maxHeight: "120px" }}
            />
            {isStreaming ? (
              <Button variant="destructive" size="icon" onClick={cancel}>
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="accent"
                size="icon"
                onClick={handleSubmit}
                disabled={!input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center">
            <ModelSelector
              value={selectedModel}
              onChange={setSelectedModel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
