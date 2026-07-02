import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import {
  filterOnlineUserIds,
  isUpstashConfigured,
  isUserOnline,
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
      res.json({ online, userId, configured: true });
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
    const ttlSeconds = Math.min(
      300,
      Math.max(30, Number((req.body as { ttlSeconds?: number })?.ttlSeconds) || 90),
    );

    if (!isUpstashConfigured()) {
      res.json({ ok: false, configured: false });
      return;
    }

    await setUserOnline(userId, ttlSeconds);

    const friendIds = parseUserIds((req.body as { friendIds?: unknown })?.friendIds);
    if (friendIds.length) {
      const onlineIds = await filterOnlineUserIds(friendIds);
      res.json({ ok: true, online: true, userIds: onlineIds, configured: true });
      return;
    }

    res.json({ ok: true, online: true, userId, configured: true });
  } catch (err) {
    next(err);
  }
});

export default router;
