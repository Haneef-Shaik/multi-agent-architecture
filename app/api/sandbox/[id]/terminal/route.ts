import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/helpers";
import { sandboxManager } from "@/lib/sandbox/manager";

/**
 * POST /api/sandbox/[id]/terminal — Create a terminal session
 * Returns a terminal session ID that can be used with the WebSocket endpoint.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { cols = 120, rows = 30 } = body as { cols?: number; rows?: number };

  const info = await sandboxManager.getInfo(id, session.userId);
  if (!info?.containerId) {
    return NextResponse.json({ error: "Sandbox not found" }, { status: 404 });
  }

  // Generate a terminal session ID — the actual shell is created
  // when the WebSocket connection is established
  const terminalId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return NextResponse.json({
    terminalId,
    sandboxId: id,
    containerId: info.containerId,
    cols,
    rows,
  });
}
