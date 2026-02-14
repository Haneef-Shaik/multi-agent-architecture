export { middleware } from "@/lib/auth/config.edge";

export const config = {
  matcher: [
    "/projects/:path*",
    "/templates/:path*",
    "/agents/:path*",
    "/api/projects/:path*",
    "/api/agent/:path*",
    "/api/sandbox/:path*",
    "/api/sessions/:path*",
    "/api/templates/:path*",
    "/api/agents/:path*",
    "/api/providers/:path*",
  ],
};
