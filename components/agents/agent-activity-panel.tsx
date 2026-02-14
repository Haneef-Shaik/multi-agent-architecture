"use client";

import { useState } from "react";
import { AgentStatusBar, type AgentStep } from "./agent-status-bar";
import { AgentTimeline, type TimelineEntry } from "./agent-timeline";
import { DagView } from "./dag-view";

interface AgentActivityPanelProps {
  steps: AgentStep[];
  timeline: TimelineEntry[];
  plan: string;
  status: "idle" | "planning" | "executing" | "completed" | "error";
  error: string | null;
  className?: string;
}

type TabId = "timeline" | "dag";

export function AgentActivityPanel({
  steps,
  timeline,
  plan,
  status,
  error,
  className = "",
}: AgentActivityPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("timeline");

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Status bar */}
      {steps.length > 0 && (
        <AgentStatusBar steps={steps} currentPlan={plan} />
      )}

      {/* Tabs */}
      <div className="flex items-center border-b border-[var(--border)] bg-[var(--panel)]">
        <button
          onClick={() => setActiveTab("timeline")}
          className={`px-3 py-1.5 text-xs transition-colors ${
            activeTab === "timeline"
              ? "text-[var(--foreground)] border-b-2 border-[var(--accent)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          Timeline
        </button>
        <button
          onClick={() => setActiveTab("dag")}
          className={`px-3 py-1.5 text-xs transition-colors ${
            activeTab === "dag"
              ? "text-[var(--foreground)] border-b-2 border-[var(--accent)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          DAG
        </button>

        {/* Status indicator */}
        <div className="flex-1" />
        <div className="px-3 text-xs text-[var(--muted-foreground)]">
          {status === "planning" && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              Planning...
            </span>
          )}
          {status === "executing" && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Executing
            </span>
          )}
          {status === "completed" && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Done
            </span>
          )}
          {status === "error" && (
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Error
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === "timeline" && (
          <AgentTimeline entries={timeline} />
        )}
        {activeTab === "dag" && (
          <div className="p-3">
            <DagView steps={steps} />
            {plan && (
              <p className="text-xs text-[var(--muted-foreground)] mt-3">
                {plan}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 bg-red-500/10 border-t border-red-500/30 text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
