"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Square, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { ModelSelector } from "./model-selector";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  sessionId: string;
  containerId?: string;
  initialMessages?: ChatMessage[];
  onEvent?: (event: string, data: Record<string, unknown>) => void;
}

export function ChatPanel({
  sessionId,
  containerId,
  initialMessages = [],
  onEvent,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(
    "anthropic/claude-sonnet-4-20250514"
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { sendMessage, cancel, isStreaming, streamedText, setStreamedText } =
    useAgentStream({
      onEvent,
      onDone() {
        // When streaming completes, finalize the assistant message
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.id === "streaming") {
            return [
              ...prev.slice(0, -1),
              { ...last, id: `msg-${Date.now()}` },
            ];
          }
          return prev;
        });
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
        setStreamedText("");
      },
    });

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
          { id: "streaming", role: "assistant", content: streamedText },
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
        {messages.length === 0 && (
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
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.id === "streaming" && (
                <span className="inline-block w-1.5 h-4 bg-[var(--accent)] animate-pulse ml-0.5" />
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
