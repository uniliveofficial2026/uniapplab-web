type Env = {
  ASSETS?: R2Bucket;
  API_ORIGIN: string;
  GAME_ORIGIN: string;
  MEDIA_ORIGIN: string;
  SPA_ORIGIN: string;
  ASSET_PREFIX?: string;
  PLATFORM_VERSION: string;
  GIT_SHA?: string;
};

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
};

function withHeaders(res: Response, extra: Record<string, string> = {}): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function proxy(request: Request, origin: string, rewritePath?: string): Promise<Response> {
  const url = new URL(request.url);
  const path = rewritePath ?? url.pathname + url.search;
  const target = new URL(path, origin);
  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    // @ts-expect-error duplex for streaming bodies
    init.duplex = "half";
  }
  const upstream = await fetch(target.toString(), init);
  if (upstream.status === 101) return upstream;
  const headers = new Headers(upstream.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

function looksLikeStaticAsset(pathname: string): boolean {
  const last = pathname.split("/").pop() || "";
  return last.includes(".") && !pathname.endsWith(".html");
}

async function spaProxy(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  // Never serve a static marketing/oauth brand page as the consumer /home shell.
  // Trailing-slash /home/ previously shadowed the SPA via public/home/index.html.
  if (url.pathname === "/home" || url.pathname === "/home/") {
    const indexUrl = new URL("/index.html", env.SPA_ORIGIN);
    const indexRes = await fetch(indexUrl.toString(), {
      method: "GET",
      headers: { Accept: "text/html", "Cache-Control": "no-cache" },
      redirect: "manual",
    });
    if (indexRes.ok) {
      const headers = new Headers(indexRes.headers);
      headers.set("Cache-Control", "public, max-age=0, must-revalidate");
      headers.set("X-UniLive-Route", "spa-home");
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
      return new Response(indexRes.body, { status: 200, headers });
    }
  }

  const upstream = await proxy(request, env.SPA_ORIGIN);
  if (upstream.status !== 404) return upstream;
  // Render static does not honor Netlify-style _redirects; SPA deep links need index.html.
  if (request.method !== "GET" && request.method !== "HEAD") return upstream;
  if (looksLikeStaticAsset(url.pathname)) return upstream;
  const indexUrl = new URL("/index.html", env.SPA_ORIGIN);
  const indexRes = await fetch(indexUrl.toString(), {
    method: "GET",
    headers: { Accept: "text/html" },
    redirect: "manual",
  });
  if (!indexRes.ok) return upstream;
  const headers = new Headers(indexRes.headers);
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(indexRes.body, { status: 200, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/__launch/health") {
      return withHeaders(
        Response.json({
          ok: true,
          service: "uniapplab-app",
          platformVersion: env.PLATFORM_VERSION || "0.1.0",
          productionRtcApi: "UniLiveRTC",
          productionMediaProvider: "LiveKit",
          gitSha: env.GIT_SHA || null,
        }),
      );
    }

    if (path.startsWith("/api/") || path === "/api") {
      return proxy(request, env.API_ORIGIN);
    }

    // Game health lives at origin /api/health; expose stable same-origin paths.
    if (
      path === "/games/greedy-slot/healthz" ||
      path === "/games/greedy-slot/api/health" ||
      path === "/games/greedy-slot/health"
    ) {
      return proxy(request, env.GAME_ORIGIN, "/api/health");
    }

    if (path.startsWith("/games/greedy-slot") || path.startsWith("/socket.io")) {
      return proxy(request, env.GAME_ORIGIN);
    }

    if (path.startsWith("/media/")) {
      return proxy(request, env.MEDIA_ORIGIN);
    }

    // Studio + docs + SPA all served from the production static origin,
    // with Worker-side SPA fallback for deep links.
    return spaProxy(request, env);
  },
};
