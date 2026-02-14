import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAuth } from "@/lib/auth/helpers";
import {
  findCustomAgentsByUser,
  findPublicAgents,
  createCustomAgent,
} from "@/lib/db/models/custom-agent";

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { searchParams } = request.nextUrl;
  const scope = searchParams.get("scope"); // "mine" | "public"

  if (scope === "public") {
    const agents = await findPublicAgents();
    return NextResponse.json(agents);
  }

  const agents = await findCustomAgentsByUser(session.userId);
  return NextResponse.json(agents);
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const {
    name,
    description,
    systemPrompt,
    model,
    tools,
    skills,
    maxToolCalls,
    color,
    icon,
    isPublic,
  } = body as {
    name: string;
    description: string;
    systemPrompt: string;
    model?: string;
    tools?: string[];
    skills?: string[];
    maxToolCalls?: number;
    color?: string;
    icon?: string;
    isPublic?: boolean;
  };

  if (!name?.trim()) {
    return NextResponse.json(
      { error: "Agent name is required" },
      { status: 400 }
    );
  }

  if (!systemPrompt?.trim()) {
    return NextResponse.json(
      { error: "System prompt is required" },
      { status: 400 }
    );
  }

  const agent = await createCustomAgent({
    userId: new ObjectId(session.userId),
    name: name.trim(),
    description: description?.trim() ?? "",
    systemPrompt: systemPrompt.trim(),
    model: model ?? "anthropic/claude-sonnet-4-20250514",
    tools: tools ?? [],
    skills: skills ?? [],
    maxToolCalls: maxToolCalls ?? 15,
    color: color ?? "#3b82f6",
    icon,
    isPublic: isPublic ?? false,
  });

  return NextResponse.json(agent, { status: 201 });
}
