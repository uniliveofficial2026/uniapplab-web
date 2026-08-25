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
import {
  postgresClearUserDevicePresence,
  postgresFilterOnlineUserIds,
  postgresIsUserOnline,
  postgresListActivePresenceDevices,
  postgresPruneExpiredPresence,
  postgresSetUserOnline,
  type PresenceBackend,
} from "../lib/postgresPresence";
import {
  memoryClearUserDevicePresence,
  memoryFilterOnlineUserIds,
  memoryIsUserOnline,
  memoryListActivePresenceDevices,
  memorySetUserOnline,
} from "../lib/memoryPresence";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type Backend = PresenceBackend | "memory";

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

function presenceWarn(err: unknown, label: string) {
  logger.warn(
    { err: err instanceof Error ? err.message : String(err) },
    `presence ${label}`,
  );
}

async function tryUpstash<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  if (!isUpstashConfigured()) return { ok: false };
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    presenceWarn(err, "upstash degraded");
    return { ok: false };
  }
}

async function tryPostgres<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    presenceWarn(err, "postgres degraded");
    return { ok: false };
  }
}

router.get("/presence/online", auth, requireNotBanned, async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const ids = parseUserIds(req.query.ids);

    const upstash = await tryUpstash(async () => {
      if (!ids.length) {
        const online = await isUserOnline(userId);
        const devices = online ? await listActivePresenceDevices(userId) : [];
        return {
          online,
          userId,
          devices,
          configured: true as const,
          backend: "upstash" as Backend,
        };
      }
      const onlineIds = await filterOnlineUserIds(ids);
      return { userIds: onlineIds, configured: true as const, backend: "upstash" as Backend };
    });
    if (upstash.ok) {
      res.json(upstash.value);
      return;
    }

    const postgres = await tryPostgres(async () => {
      void postgresPruneExpiredPresence(100);
      if (!ids.length) {
        const online = await postgresIsUserOnline(userId);
        const devices = online ? await postgresListActivePresenceDevices(userId) : [];
        return {
          online,
          userId,
          devices,
          configured: true as const,
          backend: "postgres" as Backend,
          failover: true as const,
        };
      }
      const onlineIds = await postgresFilterOnlineUserIds(ids);
      return {
        userIds: onlineIds,
        configured: true as const,
        backend: "postgres" as Backend,
        failover: true as const,
      };
    });
    if (postgres.ok) {
      res.json(postgres.value);
      return;
    }

    if (!ids.length) {
      const online = memoryIsUserOnline(userId);
      res.json({
        online,
        userId,
        devices: online ? memoryListActivePresenceDevices(userId) : [],
        configured: true,
        backend: "memory" as Backend,
        failover: true,
      });
      return;
    }
    res.json({
      userIds: memoryFilterOnlineUserIds(ids),
      configured: true,
      backend: "memory" as Backend,
      failover: true,
    });
  } catch (err) {
    presenceWarn(err, "get failed");
    res.json({ online: false, userIds: [], configured: false, degraded: true, backend: "none" });
  }
});

router.post("/presence/online", auth, requireNotBanned, async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const deviceId = resolveDeviceId(req);
    const ttlSeconds = Math.min(
      300,
      Math.max(30, Number((req.body as { ttlSeconds?: number })?.ttlSeconds) || 90),
    );
    const friendIds = parseUserIds((req.body as { friendIds?: unknown })?.friendIds);

    const upstash = await tryUpstash(async () => {
      await setUserOnline(userId, ttlSeconds, deviceId);
      if (friendIds.length) {
        const onlineIds = await filterOnlineUserIds(friendIds);
        return {
          ok: true as const,
          online: true,
          userIds: onlineIds,
          deviceId,
          configured: true as const,
          backend: "upstash" as Backend,
        };
      }
      return {
        ok: true as const,
        online: true,
        userId,
        deviceId,
        configured: true as const,
        backend: "upstash" as Backend,
      };
    });
    if (upstash.ok) {
      res.json(upstash.value);
      return;
    }

    const postgres = await tryPostgres(async () => {
      const wrote = await postgresSetUserOnline(userId, ttlSeconds, deviceId);
      if (!wrote) throw new Error("postgres presence upsert returned false");
      if (friendIds.length) {
        const onlineIds = await postgresFilterOnlineUserIds(friendIds);
        return {
          ok: true as const,
          online: true,
          userIds: onlineIds,
          deviceId,
          configured: true as const,
          backend: "postgres" as Backend,
          failover: true as const,
        };
      }
      return {
        ok: true as const,
        online: true,
        userId,
        deviceId,
        configured: true as const,
        backend: "postgres" as Backend,
        failover: true as const,
      };
    });
    if (postgres.ok) {
      res.json(postgres.value);
      return;
    }

    memorySetUserOnline(userId, ttlSeconds, deviceId);
    if (friendIds.length) {
      res.json({
        ok: true,
        online: true,
        userIds: memoryFilterOnlineUserIds(friendIds),
        deviceId,
        configured: true,
        backend: "memory" as Backend,
        failover: true,
      });
      return;
    }
    res.json({
      ok: true,
      online: true,
      userId,
      deviceId,
      configured: true,
      backend: "memory" as Backend,
      failover: true,
    });
  } catch (err) {
    presenceWarn(err, "post failed");
    res.json({ ok: false, configured: false, degraded: true, backend: "none" });
  }
});

router.post("/presence/offline", auth, requireNotBanned, async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const deviceId = resolveDeviceId(req);

    const upstash = await tryUpstash(async () => {
      await clearUserDevicePresence(userId, deviceId);
      const stillOnline = await isUserOnline(userId);
      return {
        ok: true as const,
        online: stillOnline,
        userId,
        deviceId,
        configured: true as const,
        backend: "upstash" as Backend,
      };
    });
    if (upstash.ok) {
      void postgresClearUserDevicePresence(userId, deviceId);
      memoryClearUserDevicePresence(userId, deviceId);
      res.json(upstash.value);
      return;
    }

    const postgres = await tryPostgres(async () => {
      await postgresClearUserDevicePresence(userId, deviceId);
      const stillOnline = await postgresIsUserOnline(userId);
      return {
        ok: true as const,
        online: stillOnline,
        userId,
        deviceId,
        configured: true as const,
        backend: "postgres" as Backend,
        failover: true as const,
      };
    });
    if (postgres.ok) {
      memoryClearUserDevicePresence(userId, deviceId);
      res.json(postgres.value);
      return;
    }

    memoryClearUserDevicePresence(userId, deviceId);
    res.json({
      ok: true,
      online: memoryIsUserOnline(userId),
      userId,
      deviceId,
      configured: true,
      backend: "memory" as Backend,
      failover: true,
    });
  } catch (err) {
    presenceWarn(err, "offline failed");
    res.json({ ok: false, configured: false, degraded: true, backend: "none" });
  }
});

export default router;
