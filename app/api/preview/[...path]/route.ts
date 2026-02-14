import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/helpers";
import { sandboxManager } from "@/lib/sandbox/manager";

/**
 * Preview reverse proxy.
 *
 * URL pattern: /api/preview/{sandboxId}/{port}/{...rest}
 *
 * Authenticates the user, resolves the sandbox, finds the host port mapping,
 * and proxies the request to the container's dev server.
 */
async function proxyHandler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const pathSegments = (await params).path;

  // Expect at least: sandboxId, port
  if (pathSegments.length < 2) {
    return NextResponse.json(
      { error: "URL must be /api/preview/{sandboxId}/{port}/..." },
      { status: 400 }
    );
  }

  const [sandboxId, portStr, ...rest] = pathSegments;
  const containerPort = parseInt(portStr, 10);

  if (isNaN(containerPort)) {
    return NextResponse.json(
      { error: "Invalid port number" },
      { status: 400 }
    );
  }

  // Verify sandbox ownership and get port mapping
  const info = await sandboxManager.getInfo(sandboxId, session.userId);
  if (!info) {
    return NextResponse.json({ error: "Sandbox not found" }, { status: 404 });
  }

  const portMapping = info.ports.find((p) => p.containerPort === containerPort);
  if (!portMapping) {
    return NextResponse.json(
      {
        error: `Port ${containerPort} is not mapped. Available ports: ${info.ports.map((p) => p.containerPort).join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Build the target URL
  const restPath = rest.length > 0 ? `/${rest.join("/")}` : "";
  const targetUrl = `http://localhost:${portMapping.hostPort}${restPath}`;

  // Copy search params
  const search = request.nextUrl.search;
  const fullUrl = `${targetUrl}${search}`;

  try {
    // Build headers — forward most original headers
    const headers = new Headers();
    for (const [key, value] of request.headers.entries()) {
      // Skip hop-by-hop and host headers
      if (
        ["host", "connection", "keep-alive", "transfer-encoding"].includes(
          key.toLowerCase()
        )
      ) {
        continue;
      }
      headers.set(key, value);
    }

    // Set correct host for the container
    headers.set("host", `localhost:${portMapping.hostPort}`);
    headers.set("x-forwarded-for", request.headers.get("x-forwarded-for") ?? "127.0.0.1");
    headers.set("x-forwarded-proto", "https");

    // Proxy the request
    const proxyResponse = await fetch(fullUrl, {
      method: request.method,
      headers,
      body:
        request.method !== "GET" && request.method !== "HEAD"
          ? await request.arrayBuffer()
          : undefined,
      redirect: "manual",
    });

    // Build response headers
    const responseHeaders = new Headers();
    for (const [key, value] of proxyResponse.headers.entries()) {
      // Skip hop-by-hop headers
      if (
        ["transfer-encoding", "connection", "keep-alive"].includes(
          key.toLowerCase()
        )
      ) {
        continue;
      }
      responseHeaders.set(key, value);
    }

    // Allow iframe embedding from our domain
    responseHeaders.delete("x-frame-options");
    responseHeaders.set("x-frame-options", "SAMEORIGIN");

    // Handle redirects — rewrite Location header to go through the proxy
    if (proxyResponse.status >= 300 && proxyResponse.status < 400) {
      const location = proxyResponse.headers.get("location");
      if (location) {
        // Rewrite redirect to go through our proxy
        try {
          const redirectUrl = new URL(location, fullUrl);
          const rewritten = `/api/preview/${sandboxId}/${containerPort}${redirectUrl.pathname}${redirectUrl.search}`;
          responseHeaders.set("location", rewritten);
        } catch {
          // If URL parsing fails, pass through as-is
        }
      }
    }

    return new Response(proxyResponse.body, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    // Container dev server might not be running yet
    const message =
      error instanceof Error ? error.message : "Proxy request failed";

    if (message.includes("ECONNREFUSED")) {
      return new Response(
        `<html>
          <head><title>Waiting for server...</title>
          <meta http-equiv="refresh" content="2">
          <style>
            body { font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0a0a0a; color: #888; }
            .spinner { width: 24px; height: 24px; border: 3px solid #333; border-top-color: #888; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 12px; }
            @keyframes spin { to { transform: rotate(360deg); } }
          </style></head>
          <body><div class="spinner"></div>Waiting for server on port ${containerPort}...</body>
        </html>`,
        {
          status: 503,
          headers: {
            "content-type": "text/html",
            "retry-after": "2",
          },
        }
      );
    }

    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const GET = proxyHandler;
export const POST = proxyHandler;
export const PUT = proxyHandler;
export const PATCH = proxyHandler;
export const DELETE = proxyHandler;
export const HEAD = proxyHandler;
export const OPTIONS = proxyHandler;
