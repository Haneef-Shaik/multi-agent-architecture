import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/helpers";
import { sandboxManager } from "@/lib/sandbox/manager";

/**
 * GET /api/sandbox/[id] — Get sandbox status and info
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const info = await sandboxManager.getInfo(id, session.userId);
  if (!info) {
    return NextResponse.json({ error: "Sandbox not found" }, { status: 404 });
  }

  // Also get live Docker status
  const liveStatus = await sandboxManager.getLiveStatus(id);

  return NextResponse.json({ ...info, liveStatus });
}

/**
 * DELETE /api/sandbox/[id] — Terminate a sandbox
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  try {
    await sandboxManager.terminate(id, session.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to terminate" },
      { status: 400 }
    );
  }
}

/**
 * PATCH /api/sandbox/[id] — Hibernate or resume a sandbox
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const body = await request.json();
  const { action } = body as { action: "hibernate" | "resume" };

  try {
    if (action === "hibernate") {
      await sandboxManager.hibernate(id, session.userId);
    } else if (action === "resume") {
      await sandboxManager.resume(id, session.userId);
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ success: true, action });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Action failed" },
      { status: 400 }
    );
  }
}
