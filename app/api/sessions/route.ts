import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAuth } from "@/lib/auth/helpers";
import { findProjectById } from "@/lib/db/models/project";
import {
  createSession,
  findSessionsByProject,
} from "@/lib/db/models/session";

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const { projectId } = body as { projectId: string };

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  const project = await findProjectById(projectId);
  if (!project || project.userId.toString() !== session.userId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const newSession = await createSession({
    projectId: new ObjectId(projectId),
    userId: new ObjectId(session.userId),
    status: "active",
  });

  return NextResponse.json(newSession, { status: 201 });
}

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId query param is required" },
      { status: 400 }
    );
  }

  const project = await findProjectById(projectId);
  if (!project || project.userId.toString() !== session.userId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const sessions = await findSessionsByProject(projectId);
  return NextResponse.json(sessions);
}
