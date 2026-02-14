"use client";

import { SkillBadge } from "./skill-badge";

export interface AgentStep {
  nodeId: string;
  agentId: string;
  status: "pending" | "running" | "completed" | "failed";
  skills: string[];
}

interface AgentStatusBarProps {
  steps: AgentStep[];
  currentPlan?: string;
  className?: string;
}

const AGENT_LABELS: Record<string, { label: string; color: string }> = {
  planning: { label: "Planning", color: "bg-purple-500" },
  coding: { label: "Coding", color: "bg-blue-500" },
  debugging: { label: "Debug", color: "bg-orange-500" },
  testing: { label: "Testing", color: "bg-green-500" },
  deploy: { label: "Deploy", color: "bg-cyan-500" },
  design: { label: "Design", color: "bg-pink-500" },
  database: { label: "Database", color: "bg-emerald-500" },
  review: { label: "Review", color: "bg-amber-500" },
};

export function AgentStatusBar({
  steps,
  currentPlan,
  className = "",
}: AgentStatusBarProps) {
  const running = steps.filter((s) => s.status === "running");
  const completed = steps.filter((s) => s.status === "completed");
  const failed = steps.filter((s) => s.status === "failed");

  return (
    <div
      className={`flex items-center gap-3 px-3 py-1.5 bg-[var(--panel)] border-b border-[var(--border)] text-xs ${className}`}
    >
      {/* Progress */}
      <div className="flex items-center gap-1.5">
        {steps.map((step) => {
          const agent = AGENT_LABELS[step.agentId] ?? {
            label: step.agentId,
            color: "bg-neutral-500",
          };
          return (
            <div
              key={step.nodeId}
              className="flex items-center gap-1"
              title={`${agent.label}: ${step.status}`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  step.status === "running"
                    ? `${agent.color} animate-pulse`
                    : step.status === "completed"
                      ? agent.color
                      : step.status === "failed"
                        ? "bg-red-500"
                        : "bg-neutral-600"
                }`}
              />
              <span
                className={
                  step.status === "running"
                    ? "text-[var(--foreground)] font-medium"
                    : "text-[var(--muted-foreground)]"
                }
              >
                {agent.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status summary */}
      <div className="flex-1" />
      {steps.length > 0 && (
        <span className="text-[var(--muted-foreground)]">
          {completed.length}/{steps.length} complete
          {failed.length > 0 && ` · ${failed.length} failed`}
          {running.length > 0 && ` · ${running.length} running`}
        </span>
      )}

      {/* Active skills */}
      {running.length > 0 && running[0].skills.length > 0 && (
        <div className="flex items-center gap-1">
          {running[0].skills.slice(0, 3).map((skill) => (
            <SkillBadge key={skill} name={skill} size="sm" />
          ))}
        </div>
      )}
    </div>
  );
}
