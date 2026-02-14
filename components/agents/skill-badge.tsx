"use client";

interface SkillBadgeProps {
  name: string;
  size?: "sm" | "md";
}

const SKILL_COLORS: Record<string, string> = {
  "frontend-design": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "architecture-patterns": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "software-architecture": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "code-review-pro": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "database-schema-designer": "bg-green-500/15 text-green-400 border-green-500/30",
  "color-palette-extractor": "bg-pink-500/15 text-pink-400 border-pink-500/30",
  "font-pairing-suggester": "bg-pink-500/15 text-pink-400 border-pink-500/30",
  "ai-sdk": "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

const DEFAULT_COLOR = "bg-neutral-500/15 text-neutral-400 border-neutral-500/30";

export function SkillBadge({ name, size = "sm" }: SkillBadgeProps) {
  const colorClass = SKILL_COLORS[name] ?? DEFAULT_COLOR;
  const sizeClass = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${colorClass} ${sizeClass}`}
    >
      {name}
    </span>
  );
}
