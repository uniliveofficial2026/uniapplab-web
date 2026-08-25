/**
 * Last-resort ephemeral presence when Upstash and Postgres are unavailable.
 * Process-local only — suitable for a single Render API instance.
 */
type Entry = { expiresAt: number };

const store = new Map<string, Map<string, Entry>>();

function clampTtl(ttlSeconds: number): number {
  return Math.min(300, Math.max(30, Number(ttlSeconds) || 90));
}

function normalizeDeviceId(deviceId: string): string {
  return String(deviceId || "default").trim().slice(0, 120) || "default";
}

function pruneUser(userId: string, now = Date.now()): string[] {
  const devices = store.get(userId);
  if (!devices) return [];
  const alive: string[] = [];
  for (const [deviceId, entry] of devices) {
    if (entry.expiresAt <= now) devices.delete(deviceId);
    else alive.push(deviceId);
  }
  if (!devices.size) store.delete(userId);
  return alive;
}

export function memorySetUserOnline(
  userId: string,
  ttlSeconds: number,
  deviceId = "default",
): boolean {
  if (!userId) return false;
  const device = normalizeDeviceId(deviceId);
  const ttl = clampTtl(ttlSeconds);
  let devices = store.get(userId);
  if (!devices) {
    devices = new Map();
    store.set(userId, devices);
  }
  devices.set(device, { expiresAt: Date.now() + ttl * 1000 });
  return true;
}

export function memoryClearUserDevicePresence(userId: string, deviceId = "default"): boolean {
  const devices = store.get(userId);
  if (!devices) return true;
  devices.delete(normalizeDeviceId(deviceId));
  if (!devices.size) store.delete(userId);
  return true;
}

export function memoryListActivePresenceDevices(userId: string): string[] {
  return pruneUser(userId);
}

export function memoryIsUserOnline(userId: string): boolean {
  return memoryListActivePresenceDevices(userId).length > 0;
}

export function memoryFilterOnlineUserIds(userIds: string[]): string[] {
  return [...new Set(userIds.map(String).filter(Boolean))].filter((id) =>
    memoryIsUserOnline(id),
  );
}
