import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

const ARCHITECTURE = {
  authentication: "Supabase",
  database: "Supabase Postgres",
  realtime: "Supabase Realtime",
  images: "Cloudflare R2",
  videos: "Cloudflare R2",
  livestream: "LiveKit or Tencent TRTC",
  aiBeauty: "Third-party AI SDK",
  voiceChanger: "Dedicated voice SDK",
  cdn: "Cloudflare",
  frontend: "Vercel",
  backendApis: "Supabase Edge Functions (or Cloudflare Workers for heavier workloads)",
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const mediaWorker = String(Deno.env.get("MEDIA_WORKER_URL") || "").replace(/\/$/, "");
  let media: Record<string, unknown> = {
    configured: Boolean(mediaWorker),
    provider: mediaWorker ? "cloudflare_r2_worker" : "unset",
  };
  if (mediaWorker) {
    try {
      const res = await fetch(`${mediaWorker}/health`, {
        headers: { accept: "application/json" },
      });
      const body = await res.json();
      media = { ...media, ok: res.ok && body?.reachable !== false, ...body };
    } catch (err) {
      media = {
        ...media,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return new Response(
    JSON.stringify({
      status: "ok",
      runtime: "supabase_edge_function",
      architecture: ARCHITECTURE,
      backendApis: {
        target: ARCHITECTURE.backendApis,
        current: "Supabase Edge Functions + Cloudflare Workers (media)",
      },
      media,
    }),
    {
      headers: { "content-type": "application/json", ...cors },
    },
  );
});
