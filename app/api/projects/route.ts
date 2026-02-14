import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAuth } from "@/lib/auth/helpers";
import {
  findProjectsByUser,
  createProject,
} from "@/lib/db/models/project";
import type { Framework, ProjectSettings } from "@/types/project";

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const projects = await findProjectsByUser(session.userId);
  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const { name, description, framework } = body as {
    name: string;
    description?: string;
    framework?: Framework;
  };

  if (!name?.trim()) {
    return NextResponse.json(
      { error: "Project name is required" },
      { status: 400 }
    );
  }

  const settings: ProjectSettings = {
    packageManager: "bun",
    envVars: {},
    ports: [3000],
  };

  const project = await createProject({
    userId: new ObjectId(session.userId),
    name: name.trim(),
    description: description?.trim(),
    framework: framework ?? "nextjs",
    settings,
  });

  return NextResponse.json(project, { status: 201 });
}
