"use client";

import type { AgentStep } from "./agent-status-bar";

interface DagViewProps {
  steps: AgentStep[];
  className?: string;
}

const AGENT_COLORS: Record<string, string> = {
  planning: "#a855f7",
  coding: "#3b82f6",
  debugging: "#f97316",
  testing: "#22c55e",
  deploy: "#06b6d4",
  design: "#ec4899",
  database: "#10b981",
  review: "#f59e0b",
};

const STATUS_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  pending: { border: "#333", bg: "#1a1a1a", text: "#666" },
  running: { border: "#3b82f6", bg: "#1e293b", text: "#93c5fd" },
  completed: { border: "#22c55e", bg: "#0f2a1c", text: "#86efac" },
  failed: { border: "#ef4444", bg: "#2a0f0f", text: "#fca5a5" },
};

export function DagView({ steps, className = "" }: DagViewProps) {
  if (steps.length === 0) return null;

  return (
    <div className={`flex items-center gap-1 px-3 py-2 overflow-x-auto ${className}`}>
      {steps.map((step, i) => {
        const color = AGENT_COLORS[step.agentId] ?? "#666";
        const statusStyle = STATUS_STYLES[step.status] ?? STATUS_STYLES.pending;

        return (
          <div key={step.nodeId} className="flex items-center gap-1 shrink-0">
            {/* Node */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all"
              style={{
                border: `1px solid ${statusStyle.border}`,
                backgroundColor: statusStyle.bg,
                color: statusStyle.text,
              }}
            >
              {/* Agent dot */}
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  step.status === "running" ? "animate-pulse" : ""
                }`}
                style={{ backgroundColor: color }}
              />
              <span className="font-medium capitalize">{step.agentId}</span>
            </div>

            {/* Arrow between nodes */}
            {i < steps.length - 1 && (
              <svg width="20" height="12" viewBox="0 0 20 12" className="shrink-0">
                <path
                  d="M0 6 L14 6 M10 2 L16 6 L10 10"
                  fill="none"
                  stroke="#444"
                  strokeWidth="1.5"
                />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
