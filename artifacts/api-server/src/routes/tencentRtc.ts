/**
 * Tencent RTC suite — optional backup credentials (Call / Conference / Live / Chat / RTC Engine).
 * Not used for A/V transport; LiveKit remains primary. UserSig stays server-side.
 */
import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import {
  createTencentRtcUserSig,
  getTencentRtcSdkAppId,
  isTencentRtcConfigured,
} from "../lib/tencentRtc";

const router: IRouter = Router();

/** Public health — never returns the secret. */
router.get("/tencent/rtc/health", (_req, res) => {
  const configured = isTencentRtcConfigured();
  res.status(configured ? 200 : 503).json({
    ok: configured,
    configured,
    activeTransport: "livekit",
    standby: true,
    sdkAppId: configured ? getTencentRtcSdkAppId() : null,
    products: ["call", "conference", "live", "chat", "rtc_engine"],
  });
});

/**
 * Issue a UserSig for a future Tencent RTC opt-in.
 * SecretKey stays on the server — clients must never generate UserSig locally.
 * Call/Live/Chat surfaces still use LiveKit unless product enables Tencent transport.
 */
router.post("/tencent/rtc/usersig", auth, requireNotBanned, async (req, res, next) => {
  try {
    if (!isTencentRtcConfigured()) {
      res.status(503).json({ error: "tencent_rtc_not_configured" });
      return;
    }

    const body = (req.body ?? {}) as { userId?: string; expireSeconds?: number };
    const userId = String(body.userId || req.authUser?.id || "").trim();
    if (!userId) {
      res.status(400).json({ error: "userId_required" });
      return;
    }
    // Only allow minting a sig for the authenticated user (or admins later).
    if (userId !== req.authUser!.id && req.profile?.role !== "admin") {
      res.status(403).json({ error: "usersig_user_mismatch" });
      return;
    }

    const expireSeconds =
      typeof body.expireSeconds === "number" && Number.isFinite(body.expireSeconds)
        ? body.expireSeconds
        : undefined;

    const result = createTencentRtcUserSig(userId, expireSeconds);
    res.json({
      ...result,
      activeTransport: "livekit",
      standby: true,
      products: ["call", "conference", "live", "chat", "rtc_engine"],
    });
  } catch (err) {
    next(err);
  }
});

export default router;
