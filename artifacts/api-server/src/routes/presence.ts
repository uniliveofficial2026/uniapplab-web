import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import {
  clearUserDevicePresence,
  filterOnlineUserIds,
  isUpstashConfigured,
  isUserOnline,
  listActivePresenceDevices,
  setUserOnline,
} from "../lib/upstash";

const router: IRouter = Router();

function parseUserIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((id) => String(id).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }
  return [];
}

function resolveDeviceId(req: { body?: unknown; headers: Record<string, unknown> }): string {
  const body = (req.body ?? {}) as { deviceId?: string };
  const header = req.headers["x-device-id"];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  return String(body.deviceId || fromHeader || "default").trim().slice(0, 120) || "default";
}

router.get("/presence/online", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    if (!isUpstashConfigured()) {
      res.json({ online: false, userIds: [], configured: false });
      return;
    }

    const ids = parseUserIds(req.query.ids);
    if (!ids.length) {
      const online = await isUserOnline(userId);
      const devices = online ? await listActivePresenceDevices(userId) : [];
      res.json({ online, userId, devices, configured: true });
      return;
    }

    const onlineIds = await filterOnlineUserIds(ids);
    res.json({ userIds: onlineIds, configured: true });
  } catch (err) {
    next(err);
  }
});

router.post("/presence/online", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const deviceId = resolveDeviceId(req);
    const ttlSeconds = Math.min(
      300,
      Math.max(30, Number((req.body as { ttlSeconds?: number })?.ttlSeconds) || 90),
    );

    if (!isUpstashConfigured()) {
      res.json({ ok: false, configured: false });
      return;
    }

    // Presence is ephemeral and must never be persisted in user_app_state.
    await setUserOnline(userId, ttlSeconds, deviceId);

    const friendIds = parseUserIds((req.body as { friendIds?: unknown })?.friendIds);
    if (friendIds.length) {
      const onlineIds = await filterOnlineUserIds(friendIds);
      res.json({ ok: true, online: true, userIds: onlineIds, deviceId, configured: true });
      return;
    }

    res.json({ ok: true, online: true, userId, deviceId, configured: true });
  } catch (err) {
    next(err);
  }
});

router.post("/presence/offline", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const deviceId = resolveDeviceId(req);
    if (!isUpstashConfigured()) {
      res.json({ ok: false, configured: false });
      return;
    }
    await clearUserDevicePresence(userId, deviceId);
    const stillOnline = await isUserOnline(userId);
    res.json({ ok: true, online: stillOnline, userId, deviceId, configured: true });
  } catch (err) {
    next(err);
  }
});

export default router;
