"use client";

import { useState, useCallback } from "react";

export interface FileTreeItem {
  path: string;
  name: string;
  type: "file" | "directory";
  children?: FileTreeItem[];
}

interface FileTreeProps {
  items: FileTreeItem[];
  selectedPath?: string;
  onSelect: (path: string) => void;
  className?: string;
}

interface FileTreeNodeProps {
  item: FileTreeItem;
  depth: number;
  selectedPath?: string;
  onSelect: (path: string) => void;
}

// File extension → icon mapping
const FILE_ICONS: Record<string, string> = {
  ts: "📘",
  tsx: "⚛️",
  js: "📒",
  jsx: "⚛️",
  json: "📋",
  md: "📝",
  css: "🎨",
  scss: "🎨",
  html: "🌐",
  py: "🐍",
  rs: "🦀",
  go: "🔵",
  yaml: "⚙️",
  yml: "⚙️",
  toml: "⚙️",
  env: "🔒",
  gitignore: "📂",
  dockerfile: "🐳",
  svg: "🖼️",
  png: "🖼️",
  jpg: "🖼️",
};

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const lowerName = name.toLowerCase();

  if (lowerName === "dockerfile") return "🐳";
  if (lowerName.startsWith(".env")) return "🔒";
  if (lowerName === "package.json") return "📦";
  if (lowerName === "tsconfig.json") return "📘";

  return FILE_ICONS[ext] ?? "📄";
}

function FileTreeNode({
  item,
  depth,
  selectedPath,
  onSelect,
}: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isSelected = selectedPath === item.path;

  const handleClick = useCallback(() => {
    if (item.type === "directory") {
      setExpanded((prev) => !prev);
    } else {
      onSelect(item.path);
    }
  }, [item, onSelect]);

  return (
    <div>
      <button
        onClick={handleClick}
        className={`flex items-center w-full text-left text-sm py-0.5 px-1 rounded transition-colors ${
          isSelected
            ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
            : "hover:bg-[var(--muted)] text-[var(--foreground)]"
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {item.type === "directory" ? (
          <span className="mr-1 text-xs opacity-60 w-4 text-center">
            {expanded ? "▼" : "▶"}
          </span>
        ) : (
          <span className="mr-1 text-xs w-4 text-center">
            {getFileIcon(item.name)}
          </span>
        )}
        <span className="truncate">
          {item.type === "directory" ? (
            <span className="font-medium">{item.name}</span>
          ) : (
            item.name
          )}
        </span>
      </button>

      {item.type === "directory" && expanded && item.children && (
        <div>
          {item.children.map((child) => (
            <FileTreeNode
              key={child.path}
              item={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({
  items,
  selectedPath,
  onSelect,
  className = "",
}: FileTreeProps) {
  if (items.length === 0) {
    return (
      <div className={`p-4 text-sm text-[var(--muted-foreground)] ${className}`}>
        No files yet
      </div>
    );
  }

  return (
    <div className={`py-1 overflow-auto ${className}`}>
      {items.map((item) => (
        <FileTreeNode
          key={item.path}
          item={item}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
