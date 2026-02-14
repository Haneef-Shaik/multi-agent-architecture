import { auth } from "./config";
import { NextResponse } from "next/server";

export interface AuthSession {
  userId: string;
  user: {
    email: string;
    name: string;
    image?: string;
  };
}

/**
 * Get the authenticated session or return a 401 response.
 * Use in route handlers:
 *   const session = await requireAuth();
 *   if (session instanceof NextResponse) return session;
 */
export async function requireAuth(): Promise<AuthSession | NextResponse> {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session as unknown as Record<string, unknown>).userId as
    | string
    | undefined;
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  return {
    userId,
    user: {
      email: session.user.email,
      name: session.user.name ?? "",
      image: session.user.image ?? undefined,
    },
  };
}
