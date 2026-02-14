"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LayoutTemplate,
  Globe,
  Server,
  FileCode,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Template } from "@/types/project";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  frontend: <Globe className="h-5 w-5" />,
  fullstack: <LayoutTemplate className="h-5 w-5" />,
  backend: <Server className="h-5 w-5" />,
  cli: <FileCode className="h-5 w-5" />,
};

const FRAMEWORK_COLORS: Record<string, string> = {
  nextjs: "bg-gray-800 text-white",
  react: "bg-sky-500/15 text-sky-400",
  vue: "bg-green-500/15 text-green-400",
  svelte: "bg-orange-500/15 text-orange-400",
  express: "bg-yellow-500/15 text-yellow-400",
  "python-fastapi": "bg-emerald-500/15 text-emerald-400",
  "python-flask": "bg-slate-500/15 text-slate-400",
  "static-html": "bg-purple-500/15 text-purple-400",
};

async function fetchTemplates(): Promise<Template[]> {
  const res = await fetch("/api/templates");
  if (!res.ok) return [];
  return res.json();
}

async function seedTemplates(): Promise<{ message: string }> {
  const res = await fetch("/api/templates", { method: "POST" });
  return res.json();
}

async function createProjectFromTemplate(
  template: Template
): Promise<{ _id: string }> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `My ${template.name} Project`,
      framework: template.framework,
      templateId: template._id,
    }),
  });
  if (!res.ok) throw new Error("Failed to create project");
  return res.json();
}

export default function TemplatesPage() {
  const router = useRouter();

  const {
    data: templates,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["templates"],
    queryFn: fetchTemplates,
  });

  const seed = useMutation({
    mutationFn: seedTemplates,
    onSuccess: () => refetch(),
  });

  const create = useMutation({
    mutationFn: createProjectFromTemplate,
    onSuccess: (project) => {
      router.push(`/projects/${project._id}`);
    },
  });

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Templates</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Start from a pre-built template to get up and running fast
          </p>
        </div>
        {templates && templates.length === 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => seed.mutate()}
            disabled={seed.isPending}
          >
            {seed.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <LayoutTemplate className="h-3.5 w-3.5 mr-1.5" />
            )}
            Seed Templates
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
        </div>
      ) : !templates || templates.length === 0 ? (
        <div className="border border-dashed border-[var(--border)] rounded-lg p-12 text-center">
          <LayoutTemplate className="h-10 w-10 text-[var(--muted-foreground)] mx-auto mb-3" />
          <h3 className="font-semibold mb-1">No templates yet</h3>
          <p className="text-sm text-[var(--muted-foreground)] mb-4">
            Click &quot;Seed Templates&quot; to add the default starter templates.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template._id?.toString()}
              className="group border border-[var(--border)] rounded-lg p-5 hover:border-[var(--accent)] transition-colors cursor-pointer"
              onClick={() => create.mutate(template)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-9 w-9 rounded-md bg-[var(--muted)] flex items-center justify-center text-[var(--muted-foreground)]">
                  {CATEGORY_ICONS[template.category] ?? (
                    <LayoutTemplate className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    FRAMEWORK_COLORS[template.framework] ??
                    "bg-[var(--muted)] text-[var(--muted-foreground)]"
                  }`}
                >
                  {template.framework}
                </span>
              </div>
              <h3 className="font-semibold mb-1 group-hover:text-[var(--accent)] transition-colors">
                {template.name}
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                {template.description}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <span>{template.files.length} files</span>
                <span>·</span>
                <span>
                  Port{template.defaultPorts.length > 1 ? "s" : ""}:{" "}
                  {template.defaultPorts.join(", ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
