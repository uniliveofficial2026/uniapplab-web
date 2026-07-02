import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { isUpstashConfigured, pingRedis } from "../lib/upstash";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  const upstash = isUpstashConfigured() ? await pingRedis() : { configured: false };
  res.json({ ...data, upstash });
});

export default router;
