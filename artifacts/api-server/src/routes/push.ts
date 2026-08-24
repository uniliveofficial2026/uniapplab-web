import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { getSupabaseService } from "../lib/supabase";

const router: IRouter = Router();

const PLATFORMS = new Set(["apns", "fcm", "web_push", "unknown"]);

function normalizePlatform(raw: unknown): string {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (v === "ios" || v === "apple") return "apns";
  if (v === "android" || v === "firebase") return "fcm";
  if (v === "web" || v === "webpush") return "web_push";
  if (PLATFORMS.has(v)) return v;
  return "unknown";
}

/**
 * Register or refresh DEVICE↔PERSON push binding.
 * PERSON is always the authenticated user — never trust body.personId.
 */
router.post("/register", auth, requireNotBanned, async (req, res, next) => {
  try {
    const personId = req.authUser!.id;
    const deviceId = String(req.body?.deviceId || "").trim();
    const pushToken = String(req.body?.pushToken || "").trim();
    const platform = normalizePlatform(req.body?.platform);
    if (!deviceId || !pushToken) {
      res.status(400).json({ error: "deviceId and pushToken required" });
      return;
    }
    if (deviceId === personId) {
      res.status(400).json({ error: "DEVICE must not equal PERSON" });
      return;
    }

    const sb = getSupabaseService();

    // Token uniqueness: clear any other device holding this token.
    await sb.from("push_devices").update({ push_token: null }).eq("push_token", pushToken).neq("device_id", deviceId);

    const { error } = await sb.from("push_devices").upsert(
      {
        device_id: deviceId,
        person_id: personId,
        platform,
        push_token: pushToken,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "device_id" },
    );
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ ok: true, deviceId, personId, platform });
  } catch (err) {
    next(err);
  }
});

/** Logout / account switch: clear PERSON on this DEVICE (DEVICE row may remain). */
router.post("/clear-person", auth, requireNotBanned, async (req, res, next) => {
  try {
    const personId = req.authUser!.id;
    const deviceId = String(req.body?.deviceId || "").trim();
    if (!deviceId) {
      res.status(400).json({ error: "deviceId required" });
      return;
    }
    const sb = getSupabaseService();
    const { error } = await sb
      .from("push_devices")
      .update({ person_id: null, updated_at: new Date().toISOString() })
      .eq("device_id", deviceId)
      .eq("person_id", personId);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ ok: true, deviceId });
  } catch (err) {
    next(err);
  }
});

/** List devices bound to the authenticated person (no raw tokens in response). */
router.get("/devices", auth, requireNotBanned, async (req, res, next) => {
  try {
    const personId = req.authUser!.id;
    const { data, error } = await getSupabaseService()
      .from("push_devices")
      .select("device_id, platform, updated_at")
      .eq("person_id", personId)
      .order("updated_at", { ascending: false });
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ devices: data ?? [] });
  } catch (err) {
    next(err);
  }
});

export default router;
