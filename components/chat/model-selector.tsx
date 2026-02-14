"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Cpu, Check } from "lucide-react";

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
}

interface ProviderGroup {
  id: string;
  name: string;
  available: boolean;
  models: ModelOption[];
}

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<ProviderGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/providers")
      .then((res) => res.json())
      .then((data) => {
        setGroups(data.providers ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const allModels = groups.flatMap((g) => g.models);
  const selectedModel = allModels.find((m) => m.id === value);
  const displayName = selectedModel?.name ?? "Select model";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)] transition-colors"
      >
        <Cpu className="h-3 w-3 text-[var(--muted-foreground)]" />
        <span className="max-w-[140px] truncate">
          {loading ? "Loading..." : displayName}
        </span>
        <ChevronDown className="h-3 w-3 text-[var(--muted-foreground)]" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-64 max-h-80 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg z-50">
          {groups.map((group) => (
            <div key={group.id}>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] bg-[var(--muted)]/50 sticky top-0">
                {group.name}
                {!group.available && (
                  <span className="ml-1.5 text-[9px] font-normal normal-case opacity-60">
                    (not configured)
                  </span>
                )}
              </div>
              {group.models.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  disabled={!group.available}
                  onClick={() => {
                    onChange(model.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                    group.available
                      ? "hover:bg-[var(--muted)] cursor-pointer"
                      : "opacity-40 cursor-not-allowed"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate">{model.name}</div>
                    <div className="flex gap-1 mt-0.5">
                      {model.capabilities.slice(0, 3).map((cap) => (
                        <span
                          key={cap}
                          className="text-[9px] px-1 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                  {model.id === value && (
                    <Check className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
