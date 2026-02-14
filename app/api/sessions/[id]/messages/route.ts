import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/helpers";
import { findSessionById } from "@/lib/db/models/session";
import { findMessagesBySession } from "@/lib/db/models/message";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const chatSession = await findSessionById(id);

  if (!chatSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (chatSession.userId.toString() !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limit = parseInt(
    request.nextUrl.searchParams.get("limit") ?? "50",
    10
  );
  const before = request.nextUrl.searchParams.get("before");

  const messages = await findMessagesBySession(id, {
    limit,
    before: before ? new Date(before) : undefined,
  });

  return NextResponse.json(messages);
}
