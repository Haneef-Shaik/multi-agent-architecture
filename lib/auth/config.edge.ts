import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config — no Node.js-only imports (no MongoDB, no streams).
 * Used by middleware.ts for route protection only.
 *
 * The `authorized` callback runs in the Edge runtime and only checks
 * whether the JWT session exists. DB-dependent callbacks (signIn, session)
 * live in config.ts which runs in the Node.js runtime.
 */
export const authConfig: NextAuthConfig = {
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
    newUser: "/projects",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected =
        nextUrl.pathname.startsWith("/projects") ||
        nextUrl.pathname.startsWith("/templates") ||
        nextUrl.pathname.startsWith("/agents") ||
        nextUrl.pathname.startsWith("/api/projects") ||
        nextUrl.pathname.startsWith("/api/agent") ||
        nextUrl.pathname.startsWith("/api/sandbox") ||
        nextUrl.pathname.startsWith("/api/sessions") ||
        nextUrl.pathname.startsWith("/api/templates") ||
        nextUrl.pathname.startsWith("/api/agents") ||
        nextUrl.pathname.startsWith("/api/providers");

      if (isProtected && !isLoggedIn) {
        return Response.redirect(new URL("/login", nextUrl));
      }
      return true;
    },
  },
  session: {
    strategy: "jwt",
  },
};

export const { auth: middleware } = NextAuth(authConfig);
