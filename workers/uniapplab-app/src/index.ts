type Env = {
  ASSETS: R2Bucket;
  API_ORIGIN: string;
  GAME_ORIGIN: string;
  MEDIA_ORIGIN: string;
  ASSET_PREFIX: string;
  PLATFORM_VERSION: string;
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

async function proxy(request: Request, origin: string, stripPrefix?: string): Promise<Response> {
  const url = new URL(request.url);
  let path = url.pathname + url.search;
  if (stripPrefix && path.startsWith(stripPrefix)) {
    // keep path as-is for game which expects /games/greedy-slot
  }
  const target = new URL(path, origin);
  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    // @ts-expect-error duplex for streaming
    init.duplex = "half";
  }
  const upstream = await fetch(target.toString(), init);
  // WebSocket upgrade
  if (upstream.status === 101) return upstream;
  const headers = new Headers(upstream.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
}

function contentType(path: string): string {
  const p = path.toLowerCase();
  if (p.endsWith(".html")) return "text/html; charset=utf-8";
  if (p.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (p.endsWith(".css")) return "text/css; charset=utf-8";
  if (p.endsWith(".json")) return "application/json; charset=utf-8";
  if (p.endsWith(".svg")) return "image/svg+xml";
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".woff2")) return "font/woff2";
  if (p.endsWith(".mp4")) return "video/mp4";
  if (p.endsWith(".webm")) return "video/webm";
  if (p.endsWith(".map")) return "application/json";
  return "application/octet-stream";
}

async function serveAsset(env: Env, key: string, cacheControl: string): Promise<Response | null> {
  const obj = await env.ASSETS.get(key);
  if (!obj) return null;
  const headers = new Headers();
  headers.set("Content-Type", contentType(key));
  headers.set("Cache-Control", cacheControl);
  headers.set("ETag", obj.httpEtag);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(obj.body, { status: 200, headers });
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
          platformVersion: env.PLATFORM_VERSION,
          productionRtcApi: "UniLiveRTC",
          productionMediaProvider: "LiveKit",
        }),
      );
    }

    if (path.startsWith("/api/") || path === "/api") {
      return proxy(request, env.API_ORIGIN);
    }

    if (path.startsWith("/games/greedy-slot") || path.startsWith("/socket.io")) {
      return proxy(request, env.GAME_ORIGIN);
    }

    if (path.startsWith("/media/")) {
      return proxy(request, env.MEDIA_ORIGIN);
    }

    // Docs portal
    if (path === "/docs" || path.startsWith("/docs/")) {
      const rel = path === "/docs" || path === "/docs/" ? "index.html" : path.slice("/docs/".length);
      const key = `${env.ASSET_PREFIX}/docs/${rel || "index.html"}`;
      const hit = await serveAsset(env, key, rel.includes(".") && !rel.endsWith(".html") ? "public, max-age=31536000, immutable" : "public, max-age=60");
      if (hit) return hit;
      const fallback = await serveAsset(env, `${env.ASSET_PREFIX}/docs/index.html`, "public, max-age=60");
      if (fallback) return fallback;
      return withHeaders(new Response("Docs not deployed", { status: 503 }));
    }

    // Studio static MVP shell (docs-like placeholder until full studio host)
    if (path === "/studio" || path.startsWith("/studio/")) {
      const rel = path === "/studio" || path === "/studio/" ? "index.html" : path.slice("/studio/".length);
      const key = `${env.ASSET_PREFIX}/studio/${rel || "index.html"}`;
      const hit = await serveAsset(env, key, "public, max-age=60");
      if (hit) return hit;
      const fallback = await serveAsset(env, `${env.ASSET_PREFIX}/studio/index.html`, "public, max-age=60");
      if (fallback) return fallback;
      return withHeaders(new Response("Studio not deployed", { status: 503 }));
    }

    // SPA assets
    let rel = path === "/" ? "index.html" : path.replace(/^\//, "");
    if (rel.endsWith("/")) rel += "index.html";
    const assetKey = `${env.ASSET_PREFIX}/spa/${rel}`;
    const hashed = rel.includes("/assets/") || /\.[a-f0-9]{8,}\./i.test(rel);
    let res = await serveAsset(env, assetKey, hashed ? "public, max-age=31536000, immutable" : "public, max-age=60, must-revalidate");
    if (!res && !rel.includes(".")) {
      res = await serveAsset(env, `${env.ASSET_PREFIX}/spa/index.html`, "public, max-age=60, must-revalidate");
    }
    if (res) return res;
    return withHeaders(new Response("App assets missing", { status: 503 }));
  },
};
