import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { isUpstashConfigured, pingRedis } from "../lib/upstash";
import { isR2Configured, pingR2 } from "../lib/r2";
import {
  PLATFORM_ARCHITECTURE,
  PLATFORM_NON_GOALS,
  mediaRuntimeProvider,
} from "../lib/platformArchitecture";

const router: IRouter = Router();

async function healthHandler(_req: unknown, res: { json: (body: unknown) => void }) {
  const data = HealthCheckResponse.parse({ status: "ok" });

  let upstash: { configured: boolean; ok?: boolean; reason?: string; pong?: string } = {
    configured: false,
  };
  try {
    if (isUpstashConfigured()) {
      upstash = { configured: true, ...(await pingRedis()) };
    }
  } catch (err) {
    upstash = {
      configured: true,
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  const provider = mediaRuntimeProvider();
  let media: {
    configured: boolean;
    ok?: boolean;
    error?: string;
    provider?: string;
    architecture?: string;
  } = {
    configured: isR2Configured() || Boolean(String(process.env.MEDIA_WORKER_URL || "").trim()),
    architecture: PLATFORM_ARCHITECTURE.images,
    provider,
  };

  if (provider === "cloudflare_r2_worker") {
    try {
      const worker = String(process.env.MEDIA_WORKER_URL || "").replace(/\/$/, "");
      const resPing = await fetch(`${worker}/health`);
      const body = (await resPing.json()) as { reachable?: boolean; error?: string };
      media = {
        ...media,
        configured: true,
        ok: resPing.ok && body.reachable !== false,
        error: body.error,
      };
    } catch (err) {
      media = {
        ...media,
        configured: true,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  } else if (isR2Configured()) {
    const ping = await pingR2();
    media = {
      ...media,
      configured: true,
      ok: ping.ok,
      error: ping.error,
    };
  }

  res.json({
    ...data,
    architecture: PLATFORM_ARCHITECTURE,
    nonGoals: PLATFORM_NON_GOALS,
    backendApis: {
      target: PLATFORM_ARCHITECTURE.backendApis,
      current: "Supabase Edge Functions + Cloudflare Workers (media); Vercel Express transitional",
      edgeFunctions: {
        architecture: "https://ldxrdbyznheayhbkvxlq.supabase.co/functions/v1/architecture",
        media: "https://ldxrdbyznheayhbkvxlq.supabase.co/functions/v1/media",
      },
      mediaWorker: String(process.env.MEDIA_WORKER_URL || "") || null,
    },
    upstash,
    media,
  });
}

router.get("/healthz", healthHandler);
router.get("/health", healthHandler);

router.get("/architecture", (_req, res) => {
  res.json({
    status: "ok",
    architecture: PLATFORM_ARCHITECTURE,
    nonGoals: PLATFORM_NON_GOALS,
    backendApis: {
      target: PLATFORM_ARCHITECTURE.backendApis,
      current: "Supabase Edge Functions + Cloudflare Workers (media); Vercel Express transitional",
    },
    mediaRuntime: {
      configured: isR2Configured() || Boolean(String(process.env.MEDIA_WORKER_URL || "").trim()),
      provider: mediaRuntimeProvider(),
      target: "Cloudflare R2 + Cloudflare CDN",
      publicBaseUrl: String(process.env.R2_PUBLIC_BASE_URL || "") || null,
      mediaWorkerUrl: String(process.env.MEDIA_WORKER_URL || "") || null,
    },
  });
});

export default router;
