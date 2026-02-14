import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/helpers";
import { sandboxManager } from "@/lib/sandbox/manager";
import { execInContainer } from "@/lib/sandbox/exec";

/**
 * POST /api/sandbox/[id]/exec — Execute a command in the sandbox
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const body = await request.json();
  const { command, cwd, timeoutMs } = body as {
    command: string;
    cwd?: string;
    timeoutMs?: number;
  };

  if (!command?.trim()) {
    return NextResponse.json(
      { error: "command is required" },
      { status: 400 }
    );
  }

  // Resolve sandbox to container
  const info = await sandboxManager.getInfo(id, session.userId);
  if (!info) {
    return NextResponse.json({ error: "Sandbox not found" }, { status: 404 });
  }

  if (!info.containerId) {
    return NextResponse.json(
      { error: "Sandbox has no active container" },
      { status: 400 }
    );
  }

  try {
    const result = await execInContainer(info.containerId, command, {
      cwd,
      timeoutMs,
    });

    return NextResponse.json({
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Execution failed" },
      { status: 500 }
    );
  }
}
