"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { ChatPanel } from "@/components/chat/chat-panel";
import { AgentActivityPanel } from "@/components/agents/agent-activity-panel";
import { useAgentEvents } from "@/hooks/use-agent-events";
import type { Project } from "@/types/project";
import type { Session } from "@/types/message";

async function fetchProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`);
  if (!res.ok) throw new Error("Project not found");
  return res.json();
}

async function fetchSessions(
  projectId: string
): Promise<Session[]> {
  const res = await fetch(`/api/sessions?projectId=${projectId}`);
  if (!res.ok) return [];
  return res.json();
}

async function createSessionApi(
  projectId: string
): Promise<Session> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

export default function WorkspacePage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const {
    status: agentStatus,
    plan: agentPlan,
    steps: agentSteps,
    timeline: agentTimeline,
    error: agentError,
    sandboxId: agentSandboxId,
    handleSSEEvent,
    reset: resetAgentEvents,
  } = useAgentEvents();

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => fetchProject(projectId),
  });

  const { data: sessions } = useQuery({
    queryKey: ["sessions", projectId],
    queryFn: () => fetchSessions(projectId),
    enabled: !!projectId,
  });

  const createSession = useMutation({
    mutationFn: () => createSessionApi(projectId),
    onSuccess: (session) => {
      setActiveSessionId(session._id!.toString());
    },
  });

  // Auto-create or select session
  useEffect(() => {
    if (sessions && sessions.length > 0 && !activeSessionId) {
      const active = sessions.find((s) => s.status === "active");
      setActiveSessionId(
        active?._id?.toString() ?? sessions[0]._id?.toString() ?? null
      );
    } else if (sessions && sessions.length === 0 && !activeSessionId) {
      createSession.mutate();
    }
  }, [sessions, activeSessionId]);

  if (projectLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading project...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">
        Project not found
      </div>
    );
  }

  return (
    <div className="h-screen">
      <WorkspaceLayout
        projectId={projectId}
        sandboxId={agentSandboxId}
        chatPanel={
          activeSessionId ? (
            <ChatPanel
              sessionId={activeSessionId}
              onEvent={handleSSEEvent}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Creating session...
            </div>
          )
        }
        agentActivityPanel={
          agentStatus !== "idle" ? (
            <AgentActivityPanel
              steps={agentSteps}
              timeline={agentTimeline}
              plan={agentPlan}
              status={agentStatus}
              error={agentError}
            />
          ) : undefined
        }
      />
    </div>
  );
}
