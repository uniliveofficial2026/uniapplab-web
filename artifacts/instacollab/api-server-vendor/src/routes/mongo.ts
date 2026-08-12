/**
 * MongoDB Atlas (Vercel Marketplace) — optional / non-product lane.
 * Auth, wallets, gifts, realtime, and media MUST stay on Supabase + R2.
 * Prefer not to write product data here.
 */
import { Router, type IRouter } from "express";
import { isMongoConfigured, pingMongo } from "../lib/mongo";

const router: IRouter = Router();

router.get("/mongo/health", async (_req, res) => {
  if (!isMongoConfigured()) {
    res.json({
      status: "ok",
      configured: false,
      productDataStore: false,
      note: "Mongo is not part of the platform architecture",
    });
    return;
  }
  const ping = await pingMongo();
  res.json({
    status: ping.ok ? "ok" : "degraded",
    configured: true,
    productDataStore: false,
    note: "Marketplace extras only — not used for app auth/DB/media",
    ...ping,
  });
});

export default router;
