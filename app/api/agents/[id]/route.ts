import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/helpers";
import {
  findCustomAgentById,
  updateCustomAgent,
  deleteCustomAgent,
} from "@/lib/db/models/custom-agent";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const agent = await findCustomAgentById(id);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Allow access if owner or if public
  if (
    agent.userId.toString() !== session.userId &&
    !agent.isPublic
  ) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json(agent);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const agent = await findCustomAgentById(id);

  if (!agent || agent.userId.toString() !== session.userId) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await request.json();
  const allowed = [
    "name",
    "description",
    "systemPrompt",
    "model",
    "tools",
    "skills",
    "maxToolCalls",
    "color",
    "icon",
    "isPublic",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  await updateCustomAgent(id, updates);
  const updated = await findCustomAgentById(id);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const agent = await findCustomAgentById(id);

  if (!agent || agent.userId.toString() !== session.userId) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  await deleteCustomAgent(id);
  return NextResponse.json({ deleted: true });
}
