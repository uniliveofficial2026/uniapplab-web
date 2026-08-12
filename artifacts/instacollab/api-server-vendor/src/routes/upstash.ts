import { Router, type IRouter } from "express";
import { pingRedis, isUpstashConfigured } from "../lib/upstash";

const router: IRouter = Router();

router.get("/upstash/health", async (_req, res) => {
  if (!isUpstashConfigured()) {
    res.status(503).json({ ok: false, configured: false });
    return;
  }
  const result = await pingRedis();
  res.status(result.ok ? 200 : 503).json({ configured: true, ...result });
});

export default router;
