import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/helpers";
import { sandboxManager } from "@/lib/sandbox/manager";
import { readFile, writeFile, deleteFile } from "@/lib/tools/filesystem";

/**
 * GET /api/sandbox/[id]/files?path=/workspace/src/index.ts
 * Read a file from the sandbox.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const filePath = request.nextUrl.searchParams.get("path");

  if (!filePath) {
    return NextResponse.json(
      { error: "path query parameter is required" },
      { status: 400 }
    );
  }

  const info = await sandboxManager.getInfo(id, session.userId);
  if (!info?.containerId) {
    return NextResponse.json({ error: "Sandbox not found" }, { status: 404 });
  }

  const result = await readFile(info.containerId, filePath);
  if (!result.success) {
    return NextResponse.json({ error: result.output }, { status: 404 });
  }

  return NextResponse.json({ path: filePath, content: result.output });
}

/**
 * PUT /api/sandbox/[id]/files
 * Write a file to the sandbox.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const body = await request.json();
  const { path: filePath, content } = body as {
    path: string;
    content: string;
  };

  if (!filePath || content === undefined) {
    return NextResponse.json(
      { error: "path and content are required" },
      { status: 400 }
    );
  }

  const info = await sandboxManager.getInfo(id, session.userId);
  if (!info?.containerId) {
    return NextResponse.json({ error: "Sandbox not found" }, { status: 404 });
  }

  const result = await writeFile(info.containerId, filePath, content);
  if (!result.success) {
    return NextResponse.json({ error: result.output }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: result.output });
}

/**
 * DELETE /api/sandbox/[id]/files?path=/workspace/src/old.ts
 * Delete a file from the sandbox.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const filePath = request.nextUrl.searchParams.get("path");

  if (!filePath) {
    return NextResponse.json(
      { error: "path query parameter is required" },
      { status: 400 }
    );
  }

  const info = await sandboxManager.getInfo(id, session.userId);
  if (!info?.containerId) {
    return NextResponse.json({ error: "Sandbox not found" }, { status: 404 });
  }

  const result = await deleteFile(info.containerId, filePath);
  if (!result.success) {
    return NextResponse.json({ error: result.output }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: result.output });
}
