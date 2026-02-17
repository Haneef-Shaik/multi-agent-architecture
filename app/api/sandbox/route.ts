import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/helpers";
import { sandboxManager } from "@/lib/sandbox/manager";
import { findProjectById } from "@/lib/db/models/project";

/**
 * POST /api/sandbox — Provision a sandbox for a project
 */
export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const { projectId, env } = body as {
    projectId: string;
    env?: Record<string, string>;
  };

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  // Verify project ownership
  const project = await findProjectById(projectId);
  if (!project || project.userId.toString() !== session.userId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const sandboxId = await sandboxManager.provision(
      session.userId,
      projectId,
      { env }
    );
    const containerId = await sandboxManager.resolveContainerId(sandboxId);
    const info = await sandboxManager.getInfo(sandboxId, session.userId);

    return NextResponse.json(
      {
        sandboxId,
        containerId,
        status: info?.status ?? "active",
        ports: info?.ports ?? [],
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Provisioning failed",
      },
      { status: 500 }
    );
  }
}
