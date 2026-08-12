/**
 * Supabase Edge Function — media gateway.
 * Proxies privileged media ops to the Cloudflare Worker (R2 binding).
 * Public object reads can also hit the Worker / r2.dev CDN directly.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS,HEAD",
};

function mediaWorkerBase(): string {
  return String(Deno.env.get("MEDIA_WORKER_URL") || "").replace(/\/$/, "");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}

function routePath(url: URL): string {
  // /functions/v1/media/... → keep suffix after /media
  const full = url.pathname;
  const idx = full.indexOf("/media");
  if (idx >= 0) {
    const rest = full.slice(idx + "/media".length) || "/";
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return url.pathname || "/";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const worker = mediaWorkerBase();
  if (!worker) {
    return json(
      {
        error: "MEDIA_WORKER_URL secret not set on Edge Function",
        hint: "Point to https://uniapplab-media.<account>.workers.dev",
      },
      503,
    );
  }

  const url = new URL(req.url);
  const path = routePath(url);
  const target = `${worker}${path === "/" ? "/health" : path}${url.search}`;

  const headers = new Headers();
  const auth = req.headers.get("Authorization");
  if (auth) headers.set("Authorization", auth);
  const ct = req.headers.get("Content-Type");
  if (ct) headers.set("Content-Type", ct);
  headers.set("Accept", "application/json");

  const init: RequestInit = {
    method: req.method,
    headers,
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    // @ts-expect-error duplex required for streaming body in some runtimes
    init.duplex = "half";
  }

  try {
    const upstream = await fetch(target, init);
    const outHeaders = new Headers(cors);
    const upstreamCt = upstream.headers.get("content-type");
    if (upstreamCt) outHeaders.set("content-type", upstreamCt);
    const cache = upstream.headers.get("cache-control");
    if (cache) outHeaders.set("cache-control", cache);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: outHeaders,
    });
  } catch (err) {
    return json(
      {
        error: "media worker unreachable",
        detail: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
});
