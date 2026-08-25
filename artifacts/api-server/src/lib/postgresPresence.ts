/**
 * Provider-neutral presence fallback backed by Postgres (Supabase).
 * Used when Upstash Redis is unavailable or quota-blocked.
 * Ephemeral only — never canonical identity.
 */
import { getSupabaseService } from "./supabase";
import { logger } from "./logger";

const TABLE = "presence_ephemeral";

export type PresenceBackend = "upstash" | "postgres" | "none";

function clampTtl(ttlSeconds: number): number {
  return Math.min(300, Math.max(30, Number(ttlSeconds) || 90));
}

function normalizeDeviceId(deviceId: string): string {
  return String(deviceId || "default").trim().slice(0, 120) || "default";
}

export async function postgresSetUserOnline(
  userId: string,
  ttlSeconds: number,
  deviceId = "default",
): Promise<boolean> {
  const ttl = clampTtl(ttlSeconds);
  const device = normalizeDeviceId(deviceId);
  const now = new Date();
  const expires = new Date(now.getTime() + ttl * 1000);
  const { error } = await getSupabaseService().from(TABLE).upsert(
    {
      person_id: userId,
      device_id: device,
      last_seen: now.toISOString(),
      expires_at: expires.toISOString(),
    },
    { onConflict: "person_id,device_id" },
  );
  if (error) {
    logger.warn({ err: error.message }, "postgres presence upsert failed");
    return false;
  }
  return true;
}

export async function postgresClearUserDevicePresence(
  userId: string,
  deviceId = "default",
): Promise<boolean> {
  const device = normalizeDeviceId(deviceId);
  const { error } = await getSupabaseService()
    .from(TABLE)
    .delete()
    .eq("person_id", userId)
    .eq("device_id", device);
  if (error) {
    logger.warn({ err: error.message }, "postgres presence clear failed");
    return false;
  }
  return true;
}

export async function postgresListActivePresenceDevices(userId: string): Promise<string[]> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseService()
    .from(TABLE)
    .select("device_id")
    .eq("person_id", userId)
    .gt("expires_at", now);
  if (error) {
    logger.warn({ err: error.message }, "postgres presence list failed");
    return [];
  }
  return (data ?? []).map((row) => String((row as { device_id: string }).device_id));
}

export async function postgresIsUserOnline(userId: string): Promise<boolean> {
  const devices = await postgresListActivePresenceDevices(userId);
  return devices.length > 0;
}

export async function postgresFilterOnlineUserIds(userIds: string[]): Promise<string[]> {
  if (!userIds.length) return [];
  const now = new Date().toISOString();
  const unique = [...new Set(userIds.map(String).filter(Boolean))];
  const { data, error } = await getSupabaseService()
    .from(TABLE)
    .select("person_id")
    .in("person_id", unique)
    .gt("expires_at", now);
  if (error) {
    logger.warn({ err: error.message }, "postgres presence filter failed");
    return [];
  }
  return [...new Set((data ?? []).map((row) => String((row as { person_id: string }).person_id)))];
}

/** Best-effort prune of expired rows (bounded). */
export async function postgresPruneExpiredPresence(limit = 500): Promise<void> {
  const now = new Date().toISOString();
  const { data } = await getSupabaseService()
    .from(TABLE)
    .select("person_id, device_id")
    .lt("expires_at", now)
    .limit(limit);
  if (!data?.length) return;
  for (const row of data as Array<{ person_id: string; device_id: string }>) {
    await getSupabaseService()
      .from(TABLE)
      .delete()
      .eq("person_id", row.person_id)
      .eq("device_id", row.device_id);
  }
}
