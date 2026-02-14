"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Plus,
  Trash2,
  Pencil,
  Globe,
  Lock,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CustomAgent } from "@/types/agent";

const AVAILABLE_TOOLS = [
  { id: "readFile", label: "Read File" },
  { id: "writeFile", label: "Write File" },
  { id: "editFile", label: "Edit File" },
  { id: "deleteFile", label: "Delete File" },
  { id: "executeCommand", label: "Execute Command" },
  { id: "listDirectory", label: "List Directory" },
  { id: "searchFiles", label: "Search Files" },
  { id: "grep", label: "Grep" },
  { id: "gitCommit", label: "Git Commit" },
  { id: "gitStatus", label: "Git Status" },
  { id: "gitDiff", label: "Git Diff" },
  { id: "installPackages", label: "Install Packages" },
  { id: "runScript", label: "Run Script" },
  { id: "startProcess", label: "Start Process" },
  { id: "screenshot", label: "Screenshot" },
  { id: "getPageContent", label: "Get Page Content" },
];

const COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
];

interface ProviderModel {
  id: string;
  name: string;
  provider: string;
  available: boolean;
  capabilities: string[];
}

interface ProviderData {
  providers: Array<{ id: string; name: string; configured: boolean }>;
  models: ProviderModel[];
}

// Fallback models if the API call fails
const FALLBACK_MODELS = [
  { id: "anthropic/claude-sonnet-4-20250514", name: "Claude Sonnet 4", provider: "anthropic" },
  { id: "anthropic/claude-opus-4-20250514", name: "Claude Opus 4", provider: "anthropic" },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "openai" },
  { id: "google/gemini-2.5-pro-preview-05-06", name: "Gemini 2.5 Pro", provider: "google" },
];

async function fetchProviders(): Promise<ProviderData> {
  const res = await fetch("/api/providers");
  if (!res.ok) {
    return {
      providers: [],
      models: FALLBACK_MODELS.map((m) => ({
        ...m,
        available: true,
        capabilities: [],
      })),
    };
  }
  return res.json();
}

async function fetchAgents(): Promise<CustomAgent[]> {
  const res = await fetch("/api/agents");
  if (!res.ok) return [];
  return res.json();
}

async function createAgentApi(
  data: Partial<CustomAgent>
): Promise<CustomAgent> {
  const res = await fetch("/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create agent");
  return res.json();
}

async function updateAgentApi({
  id,
  data,
}: {
  id: string;
  data: Partial<CustomAgent>;
}): Promise<CustomAgent> {
  const res = await fetch(`/api/agents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update agent");
  return res.json();
}

async function deleteAgentApi(id: string): Promise<void> {
  const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete agent");
}

interface AgentFormData {
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  tools: string[];
  skills: string[];
  maxToolCalls: number;
  color: string;
  isPublic: boolean;
}

const defaultForm: AgentFormData = {
  name: "",
  description: "",
  systemPrompt: "",
  model: "anthropic/claude-sonnet-4-20250514",
  tools: ["readFile", "writeFile", "editFile", "executeCommand", "listDirectory"],
  skills: [],
  maxToolCalls: 15,
  color: "#3b82f6",
  isPublic: false,
};

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AgentFormData>(defaultForm);

  const { data: agents, isLoading } = useQuery({
    queryKey: ["custom-agents"],
    queryFn: fetchAgents,
  });

  const { data: providerData } = useQuery({
    queryKey: ["providers"],
    queryFn: fetchProviders,
  });

  const allModels = providerData?.models ?? [];
  const providerNames = new Map(
    (providerData?.providers ?? []).map((p) => [p.id, p.name])
  );

  const createAgent = useMutation({
    mutationFn: createAgentApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-agents"] });
      resetEditor();
    },
  });

  const updateAgent = useMutation({
    mutationFn: updateAgentApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-agents"] });
      resetEditor();
    },
  });

  const deleteAgent = useMutation({
    mutationFn: deleteAgentApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-agents"] });
    },
  });

  function resetEditor() {
    setShowEditor(false);
    setEditingId(null);
    setForm(defaultForm);
  }

  function startEdit(agent: CustomAgent) {
    setEditingId(agent._id?.toString() ?? null);
    setForm({
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      tools: agent.tools,
      skills: agent.skills,
      maxToolCalls: agent.maxToolCalls,
      color: agent.color,
      isPublic: agent.isPublic,
    });
    setShowEditor(true);
  }

  function handleSubmit() {
    if (editingId) {
      updateAgent.mutate({ id: editingId, data: form });
    } else {
      createAgent.mutate(form);
    }
  }

  function toggleTool(toolId: string) {
    setForm((prev) => ({
      ...prev,
      tools: prev.tools.includes(toolId)
        ? prev.tools.filter((t) => t !== toolId)
        : [...prev.tools, toolId],
    }));
  }

  const isPending = createAgent.isPending || updateAgent.isPending;

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Custom Agents</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Create and manage custom AI agents with specific tools and skills
          </p>
        </div>
        {!showEditor && (
          <Button
            variant="accent"
            size="sm"
            onClick={() => {
              setForm(defaultForm);
              setEditingId(null);
              setShowEditor(true);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Agent
          </Button>
        )}
      </div>

      {/* Editor */}
      {showEditor && (
        <div className="border border-[var(--border)] rounded-lg p-6 mb-8 bg-[var(--panel)]">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold">
              {editingId ? "Edit Agent" : "Create Agent"}
            </h2>
            <Button variant="ghost" size="sm" onClick={resetEditor}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {/* Name + Color */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="My Custom Agent"
                  className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                  Color
                </label>
                <div className="flex gap-1.5 mt-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm((p) => ({ ...p, color: c }))}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        form.color === c
                          ? "border-white scale-110"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                Description
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="What does this agent do?"
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              />
            </div>

            {/* System Prompt */}
            <div>
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                System Prompt
              </label>
              <textarea
                value={form.systemPrompt}
                onChange={(e) =>
                  setForm((p) => ({ ...p, systemPrompt: e.target.value }))
                }
                placeholder="You are a specialized agent that..."
                rows={6}
                className="w-full resize-none rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              />
            </div>

            {/* Model */}
            <div>
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                Model
              </label>
              <select
                value={form.model}
                onChange={(e) =>
                  setForm((p) => ({ ...p, model: e.target.value }))
                }
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                {(() => {
                  const grouped = new Map<string, ProviderModel[]>();
                  for (const m of allModels) {
                    const list = grouped.get(m.provider) ?? [];
                    list.push(m);
                    grouped.set(m.provider, list);
                  }
                  return Array.from(grouped.entries()).map(
                    ([providerId, models]) => (
                      <optgroup
                        key={providerId}
                        label={providerNames.get(providerId) ?? providerId}
                      >
                        {models.map((m) => (
                          <option
                            key={m.id}
                            value={m.id}
                            disabled={!m.available}
                          >
                            {m.name}
                            {!m.available ? " (not configured)" : ""}
                          </option>
                        ))}
                      </optgroup>
                    )
                  );
                })()}
              </select>
            </div>

            {/* Tools */}
            <div>
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                Tools ({form.tools.length} selected)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_TOOLS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => toggleTool(t.id)}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors border ${
                      form.tools.includes(t.id)
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)]/50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Max tool calls + Public toggle */}
            <div className="flex gap-4 items-end">
              <div>
                <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                  Max Tool Calls
                </label>
                <input
                  type="number"
                  value={form.maxToolCalls}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      maxToolCalls: parseInt(e.target.value, 10) || 15,
                    }))
                  }
                  min={1}
                  max={50}
                  className="w-24 rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                />
              </div>
              <button
                onClick={() =>
                  setForm((p) => ({ ...p, isPublic: !p.isPublic }))
                }
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs border transition-colors ${
                  form.isPublic
                    ? "border-green-500/50 text-green-400 bg-green-500/10"
                    : "border-[var(--border)] text-[var(--muted-foreground)]"
                }`}
              >
                {form.isPublic ? (
                  <Globe className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                {form.isPublic ? "Public" : "Private"}
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="accent"
                size="sm"
                onClick={handleSubmit}
                disabled={isPending || !form.name.trim() || !form.systemPrompt.trim()}
              >
                {isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                )}
                {editingId ? "Save Changes" : "Create Agent"}
              </Button>
              <Button variant="ghost" size="sm" onClick={resetEditor}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Agent List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
        </div>
      ) : !agents || agents.length === 0 ? (
        <div className="border border-dashed border-[var(--border)] rounded-lg p-12 text-center">
          <Bot className="h-10 w-10 text-[var(--muted-foreground)] mx-auto mb-3" />
          <h3 className="font-semibold mb-1">No custom agents yet</h3>
          <p className="text-sm text-[var(--muted-foreground)]">
            Create your first custom agent to extend the platform with
            specialized capabilities.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <div
              key={agent._id?.toString()}
              className="flex items-center gap-4 border border-[var(--border)] rounded-lg p-4 hover:border-[var(--accent)]/30 transition-colors"
            >
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${agent.color}20` }}
              >
                <Bot
                  className="h-5 w-5"
                  style={{ color: agent.color }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{agent.name}</h3>
                  {agent.isPublic ? (
                    <Globe className="h-3 w-3 text-green-400" />
                  ) : (
                    <Lock className="h-3 w-3 text-[var(--muted-foreground)]" />
                  )}
                </div>
                <p className="text-xs text-[var(--muted-foreground)] truncate">
                  {agent.description || agent.systemPrompt.slice(0, 100)}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted-foreground)]">
                  <span>{agent.tools.length} tools</span>
                  <span>·</span>
                  <span>{agent.model.split("/").pop()}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEdit(agent)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (agent._id) deleteAgent.mutate(agent._id.toString());
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
