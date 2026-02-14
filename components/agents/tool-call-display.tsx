"use client";

import { useState } from "react";

export interface ToolCallInfo {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: string;
  status: "running" | "completed" | "error";
  duration?: number;
  timestamp: number;
}

interface ToolCallDisplayProps {
  toolCall: ToolCallInfo;
}

const TOOL_ICONS: Record<string, string> = {
  readFile: "📖",
  writeFile: "✏️",
  editFile: "🔧",
  deleteFile: "🗑️",
  moveFile: "📁",
  listDirectory: "📂",
  searchFiles: "🔍",
  grep: "🔎",
  executeCommand: "⚡",
  startProcess: "🚀",
  killProcess: "🛑",
  gitInit: "📦",
  gitCommit: "💾",
  gitDiff: "📊",
  gitStatus: "📋",
  gitLog: "📜",
  gitBranch: "🌿",
  installPackages: "📥",
  runScript: "▶️",
};

function formatToolArgs(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case "readFile":
    case "deleteFile":
      return String(args.path ?? "");
    case "writeFile":
      return `${args.path} (${String(args.content ?? "").length} chars)`;
    case "editFile":
      return String(args.path ?? "");
    case "executeCommand":
      return String(args.command ?? "").slice(0, 80);
    case "installPackages":
      return (args.packages as string[])?.join(", ") ?? "";
    case "runScript":
      return String(args.script ?? "");
    case "gitCommit":
      return String(args.message ?? "").slice(0, 60);
    case "searchFiles":
      return String(args.pattern ?? "");
    case "grep":
      return String(args.pattern ?? "");
    case "startProcess":
      return String(args.command ?? "").slice(0, 60);
    case "moveFile":
      return `${args.from} → ${args.to}`;
    default:
      return Object.values(args).map(String).join(", ").slice(0, 80);
  }
}

export function ToolCallDisplay({ toolCall }: ToolCallDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  const icon = TOOL_ICONS[toolCall.toolName] ?? "🔨";
  const argsPreview = formatToolArgs(toolCall.toolName, toolCall.args);

  return (
    <div className="border border-[var(--border)] rounded-md overflow-hidden text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--muted)] transition-colors"
      >
        {/* Status indicator */}
        <span className="shrink-0">
          {toolCall.status === "running" ? (
            <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          ) : toolCall.status === "error" ? (
            <span className="text-red-400">✗</span>
          ) : (
            <span className="text-green-400">✓</span>
          )}
        </span>

        {/* Icon + tool name */}
        <span className="shrink-0">{icon}</span>
        <span className="font-medium text-[var(--foreground)]">
          {toolCall.toolName}
        </span>

        {/* Args preview */}
        <span className="truncate text-[var(--muted-foreground)] flex-1 text-left">
          {argsPreview}
        </span>

        {/* Duration */}
        {toolCall.duration !== undefined && (
          <span className="text-[var(--muted-foreground)] shrink-0">
            {toolCall.duration}ms
          </span>
        )}

        {/* Expand arrow */}
        <span className="text-[var(--muted-foreground)] shrink-0">
          {expanded ? "▼" : "▶"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border)] bg-[var(--panel)]">
          {/* Arguments */}
          <div className="px-2.5 py-1.5">
            <div className="text-[var(--muted-foreground)] mb-0.5">Arguments:</div>
            <pre className="text-[10px] bg-[var(--background)] rounded p-1.5 overflow-x-auto max-h-32 overflow-y-auto">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>

          {/* Result */}
          {toolCall.result && (
            <div className="px-2.5 py-1.5 border-t border-[var(--border)]">
              <div className="text-[var(--muted-foreground)] mb-0.5">Result:</div>
              <pre className="text-[10px] bg-[var(--background)] rounded p-1.5 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                {toolCall.result.slice(0, 2000)}
                {toolCall.result.length > 2000 && "\n... (truncated)"}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
