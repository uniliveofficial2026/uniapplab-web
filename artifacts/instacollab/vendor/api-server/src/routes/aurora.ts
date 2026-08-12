/**
 * Amazon Aurora (Vercel Marketplace) — optional / non-product lane.
 * Supabase Postgres is the canonical database.
 */
import { Router, type IRouter } from "express";
import { isAuroraConfigured, pingAurora } from "../lib/aurora";

const router: IRouter = Router();

router.get("/aurora/health", async (_req, res) => {
  if (!isAuroraConfigured()) {
    res.json({
      status: "ok",
      configured: false,
      productDataStore: false,
      note: "Aurora is not part of the platform architecture",
    });
    return;
  }
  const ping = await pingAurora();
  res.json({
    status: ping.ok ? "ok" : "degraded",
    configured: true,
    productDataStore: false,
    note: "Marketplace extras only — Supabase Postgres is canonical",
    ...ping,
  });
});

export default router;
