"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { Plus, FolderOpen, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Project, Framework } from "@/types/project";

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json();
}

async function createProjectApi(data: {
  name: string;
  framework: Framework;
}): Promise<Project> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create project");
  return res.json();
}

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFramework, setNewFramework] = useState<Framework>("nextjs");

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const createMutation = useMutation({
    mutationFn: createProjectApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setShowCreate(false);
      setNewName("");
    },
  });

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage your applications
          </p>
        </div>
        <Button variant="accent" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Create project form */}
      {showCreate && (
        <div className="border border-border rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-3">Create New Project</h3>
          <div className="flex gap-3">
            <Input
              placeholder="Project name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  createMutation.mutate({
                    name: newName,
                    framework: newFramework,
                  });
                }
              }}
            />
            <select
              value={newFramework}
              onChange={(e) => setNewFramework(e.target.value as Framework)}
              className="h-9 rounded-md border border-border bg-transparent px-3 text-sm"
            >
              <option value="nextjs">Next.js</option>
              <option value="react">React</option>
              <option value="vue">Vue</option>
              <option value="svelte">Svelte</option>
              <option value="python-flask">Python Flask</option>
              <option value="python-django">Python Django</option>
              <option value="python-fastapi">Python FastAPI</option>
              <option value="express">Express</option>
              <option value="static-html">Static HTML</option>
              <option value="custom">Custom</option>
            </select>
            <Button
              variant="accent"
              onClick={() =>
                createMutation.mutate({
                  name: newName,
                  framework: newFramework,
                })
              }
              disabled={!newName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Project list */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading projects...</div>
      ) : projects?.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold mb-1">No projects yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first project to start building
          </p>
          <Button variant="accent" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects?.map((project) => (
            <Link
              key={project._id?.toString()}
              href={`/projects/${project._id?.toString()}`}
              className="border border-border rounded-lg p-4 hover:border-accent/50 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold group-hover:text-accent transition-colors">
                    {project.name}
                  </h3>
                  {project.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {project.description}
                    </p>
                  )}
                </div>
                <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                  {project.framework}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(project.updatedAt).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
