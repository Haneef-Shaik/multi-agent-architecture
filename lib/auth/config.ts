import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { authConfig as edgeConfig } from "./config.edge";
import { findUserByEmail, createUser } from "@/lib/db/models/user";

/**
 * Full auth config — extends the Edge-safe config with DB-dependent callbacks.
 * This runs in the Node.js runtime only (route handlers, server components).
 * Middleware uses config.edge.ts directly.
 */
export const authConfig: NextAuthConfig = {
  ...edgeConfig,
  callbacks: {
    ...edgeConfig.callbacks,
    async signIn({ user, account }) {
      if (!user.email) return false;

      const existingUser = await findUserByEmail(user.email);
      if (!existingUser) {
        await createUser({
          email: user.email,
          name: user.name ?? user.email.split("@")[0],
          image: user.image ?? undefined,
          authProvider: (account?.provider as "github" | "google") ?? "github",
          authProviderId: account?.providerAccountId,
          preferences: {
            defaultMode: "simple",
            theme: "system",
          },
          usage: {
            tokensUsedThisMonth: 0,
            sandboxMinutesThisMonth: 0,
          },
          plan: "free",
          apiKeys: {},
        });
      }
      return true;
    },
    async session({ session }) {
      if (session.user?.email) {
        const dbUser = await findUserByEmail(session.user.email);
        if (dbUser?._id) {
          (session as unknown as Record<string, unknown>).userId =
            dbUser._id.toString();
        }
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
