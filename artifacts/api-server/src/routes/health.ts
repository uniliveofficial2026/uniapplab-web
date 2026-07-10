import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { isUpstashConfigured, pingRedis } from "../lib/upstash";

const router: IRouter = Router();

async function healthHandler(_req: unknown, res: { json: (body: unknown) => void }) {
  const data = HealthCheckResponse.parse({ status: "ok" });
  const upstash = isUpstashConfigured() ? await pingRedis() : { configured: false };
  res.json({ ...data, upstash });
}

router.get("/healthz", healthHandler);
router.get("/health", healthHandler);

export default router;
