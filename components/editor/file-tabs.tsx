"use client";

interface FileTab {
  path: string;
  name: string;
  modified?: boolean;
}

interface FileTabsProps {
  tabs: FileTab[];
  activeTab?: string;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  className?: string;
}

export function FileTabs({
  tabs,
  activeTab,
  onSelect,
  onClose,
  className = "",
}: FileTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div
      className={`flex items-center bg-[var(--panel)] border-b border-[var(--border)] overflow-x-auto ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.path;
        return (
          <div
            key={tab.path}
            className={`group flex items-center gap-1 px-3 py-1.5 text-xs border-r border-[var(--border)] cursor-pointer transition-colors shrink-0 ${
              isActive
                ? "bg-[var(--background)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            }`}
            onClick={() => onSelect(tab.path)}
          >
            <span className="truncate max-w-[120px]">{tab.name}</span>
            {tab.modified && (
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.path);
              }}
              className="ml-1 opacity-0 group-hover:opacity-100 hover:bg-[var(--muted)] rounded p-0.5 transition-opacity shrink-0"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M2 2l6 6M8 2l-6 6" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
