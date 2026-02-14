"use client";

import { ToolCallDisplay, type ToolCallInfo } from "./tool-call-display";
import { SkillBadge } from "./skill-badge";

export interface TimelineEntry {
  id: string;
  type: "plan" | "agent_start" | "agent_complete" | "agent_error" | "tool_call" | "text";
  timestamp: number;
  agentId?: string;
  data: Record<string, unknown>;
}

interface AgentTimelineProps {
  entries: TimelineEntry[];
  className?: string;
}

const AGENT_LABELS: Record<string, string> = {
  planning: "Planning Agent",
  coding: "Coding Agent",
  debugging: "Debug Agent",
  testing: "Testing Agent",
  deploy: "Deploy Agent",
  design: "Design Agent",
  database: "Database Agent",
  review: "Review Agent",
  supervisor: "Supervisor",
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AgentTimeline({ entries, className = "" }: AgentTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className={`p-4 text-sm text-[var(--muted-foreground)] ${className}`}>
        No agent activity yet. Send a message to get started.
      </div>
    );
  }

  return (
    <div className={`space-y-2 p-3 overflow-auto ${className}`}>
      {entries.map((entry) => (
        <TimelineEntryRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function TimelineEntryRow({ entry }: { entry: TimelineEntry }) {
  const time = formatTime(entry.timestamp);
  const agentLabel = entry.agentId
    ? AGENT_LABELS[entry.agentId] ?? entry.agentId
    : "";

  switch (entry.type) {
    case "plan":
      return (
        <div className="flex gap-2 text-xs">
          <span className="text-[var(--muted-foreground)] shrink-0 w-16">
            {time}
          </span>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="font-medium text-[var(--foreground)]">
                Execution Plan
              </span>
            </div>
            <p className="text-[var(--muted-foreground)] ml-3.5">
              {String(entry.data.plan ?? "")}
            </p>
            {Array.isArray(entry.data.steps) && (
              <div className="ml-3.5 mt-1 space-y-0.5">
                {(entry.data.steps as Array<{ agentId: string; task: string }>).map(
                  (step, i) => (
                    <div
                      key={i}
                      className="text-[var(--muted-foreground)] flex gap-1"
                    >
                      <span className="opacity-50">{i + 1}.</span>
                      <span className="font-medium">
                        {AGENT_LABELS[step.agentId] ?? step.agentId}
                      </span>
                      <span className="opacity-70">— {step.task}</span>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      );

    case "agent_start":
      return (
        <div className="flex gap-2 text-xs">
          <span className="text-[var(--muted-foreground)] shrink-0 w-16">
            {time}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="font-medium text-[var(--foreground)]">
              {agentLabel}
            </span>
            <span className="text-[var(--muted-foreground)]">started</span>
            {(entry.data.skills as string[] | undefined)?.map((skill) => (
              <SkillBadge key={skill} name={skill} size="sm" />
            ))}
          </div>
        </div>
      );

    case "agent_complete":
      return (
        <div className="flex gap-2 text-xs">
          <span className="text-[var(--muted-foreground)] shrink-0 w-16">
            {time}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="font-medium text-[var(--foreground)]">
              {agentLabel}
            </span>
            <span className="text-green-400">completed</span>
          </div>
        </div>
      );

    case "agent_error":
      return (
        <div className="flex gap-2 text-xs">
          <span className="text-[var(--muted-foreground)] shrink-0 w-16">
            {time}
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="font-medium text-[var(--foreground)]">
                {agentLabel}
              </span>
              <span className="text-red-400">failed</span>
            </div>
            {typeof entry.data.error === "string" && (
              <p className="text-red-400/80 ml-3.5 mt-0.5">
                {entry.data.error}
              </p>
            )}
          </div>
        </div>
      );

    case "tool_call":
      return (
        <div className="flex gap-2 text-xs">
          <span className="text-[var(--muted-foreground)] shrink-0 w-16">
            {time}
          </span>
          <div className="flex-1 min-w-0">
            <ToolCallDisplay
              toolCall={entry.data as unknown as ToolCallInfo}
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}
