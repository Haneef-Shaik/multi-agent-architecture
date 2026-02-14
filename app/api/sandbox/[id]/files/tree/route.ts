import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/helpers";
import { sandboxManager } from "@/lib/sandbox/manager";
import { getFileTree } from "@/lib/tools/filesystem";

/**
 * GET /api/sandbox/[id]/files/tree?path=/workspace&depth=4
 * Get the file tree from the sandbox.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const rootPath =
    request.nextUrl.searchParams.get("path") ?? "/workspace";
  const depth = parseInt(
    request.nextUrl.searchParams.get("depth") ?? "4",
    10
  );

  const info = await sandboxManager.getInfo(id, session.userId);
  if (!info?.containerId) {
    return NextResponse.json({ error: "Sandbox not found" }, { status: 404 });
  }

  const result = await getFileTree(info.containerId, rootPath, depth);
  if (!result.success) {
    return NextResponse.json({ error: result.output }, { status: 500 });
  }

  // Parse the flat file list into a tree structure
  const lines = result.output
    .split("\n")
    .filter(Boolean)
    .map((line) => line.trim());

  return NextResponse.json({ root: rootPath, files: lines });
}
