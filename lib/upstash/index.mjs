import { Redis } from '@upstash/redis';

/** Redis key namespace for InstaCollab */
export const KEYS = {
  handoffQueue: 'ic:handoff:queue',
  uxSignals: 'ic:ux:signals',
  feedPosts: 'ic:feed:posts',
  handoffState: 'ic:handoff:state',
  presencePrefix: 'ic:presence:',
  presenceDeviceIndexPrefix: 'ic:presence:devices:',
  typingSetPrefix: 'ic:typing:set:',
  streamViewersPrefix: 'ic:stream:viewers:',
  streamViewerSessionPrefix: 'ic:stream:viewer-session:',
};

let redis = null;

export function isUpstashConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

export function getRedis() {
  if (!isUpstashConfigured()) return null;
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL.trim(),
      token: process.env.UPSTASH_REDIS_REST_TOKEN.trim(),
    });
  }
  return redis;
}

export async function pingRedis() {
  const client = getRedis();
  if (!client) return { ok: false, reason: 'not_configured' };
  try {
    const pong = await client.ping();
    return { ok: pong === 'PONG', pong };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

export async function pushHandoffTask(task) {
  const client = getRedis();
  if (!client) return false;
  const entry = {
    id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    t: Date.now(),
    status: 'pending',
    priority: 3,
    ...task,
  };
  await client.lpush(KEYS.handoffQueue, JSON.stringify(entry));
  return entry.id;
}

export async function popHandoffTasks(limit = 50) {
  const client = getRedis();
  if (!client) return [];
  const raw = await client.lrange(KEYS.handoffQueue, 0, limit - 1);
  if (!raw?.length) return [];
  return raw
    .map((line) => {
      try {
        return typeof line === 'string' ? JSON.parse(line) : line;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export async function trimHandoffQueue(keep = 200) {
  const client = getRedis();
  if (!client) return;
  await client.ltrim(KEYS.handoffQueue, 0, keep - 1);
}

export async function pushUxSignals(signals) {
  const client = getRedis();
  if (!client || !signals?.length) return false;
  const pipeline = client.pipeline();
  for (const signal of signals) {
    pipeline.lpush(KEYS.uxSignals, JSON.stringify(signal));
  }
  pipeline.ltrim(KEYS.uxSignals, 0, 499);
  await pipeline.exec();
  return true;
}

export async function getCachedFeedPosts() {
  const client = getRedis();
  if (!client) return null;
  return client.get(KEYS.feedPosts);
}

export async function setCachedFeedPosts(posts, ttlSeconds = 60) {
  const client = getRedis();
  if (!client) return false;
  await client.set(KEYS.feedPosts, JSON.stringify(posts), { ex: ttlSeconds });
  return true;
}

/**
 * Multi-device presence: each device has its own TTL key.
 * A user is online when at least one device key still exists.
 * Presence is ephemeral and must never be persisted in user_app_state.
 */
export async function setUserOnline(userId, ttlSeconds = 90, deviceId = 'default') {
  const client = getRedis();
  if (!client || !userId) return false;
  const device = String(deviceId || 'default').slice(0, 120);
  const ttl = Math.min(300, Math.max(30, Number(ttlSeconds) || 90));
  const deviceKey = `${KEYS.presencePrefix}${userId}:${device}`;
  const indexKey = `${KEYS.presenceDeviceIndexPrefix}${userId}`;
  // Legacy single-key heartbeat for older clients.
  const legacyKey = `${KEYS.presencePrefix}${userId}`;
  await client.set(deviceKey, '1', { ex: ttl });
  await client.set(legacyKey, '1', { ex: ttl });
  await client.sadd(indexKey, device);
  await client.expire(indexKey, ttl + 30);
  return true;
}

export async function clearUserDevicePresence(userId, deviceId = 'default') {
  const client = getRedis();
  if (!client || !userId) return false;
  const device = String(deviceId || 'default').slice(0, 120);
  const deviceKey = `${KEYS.presencePrefix}${userId}:${device}`;
  const indexKey = `${KEYS.presenceDeviceIndexPrefix}${userId}`;
  await client.del(deviceKey);
  await client.srem(indexKey, device);
  const remaining = await listActivePresenceDevices(userId);
  if (!remaining.length) {
    await client.del(`${KEYS.presencePrefix}${userId}`);
  }
  return true;
}

export async function listActivePresenceDevices(userId) {
  const client = getRedis();
  if (!client || !userId) return [];
  const indexKey = `${KEYS.presenceDeviceIndexPrefix}${userId}`;
  const members = await client.smembers(indexKey);
  if (!Array.isArray(members) || !members.length) {
    const legacy = await client.exists(`${KEYS.presencePrefix}${userId}`);
    return legacy === 1 ? ['default'] : [];
  }
  const active = [];
  for (const device of members) {
    const exists = await client.exists(`${KEYS.presencePrefix}${userId}:${device}`);
    if (exists === 1) active.push(String(device));
    else await client.srem(indexKey, device);
  }
  if (!active.length) {
    const legacy = await client.exists(`${KEYS.presencePrefix}${userId}`);
    if (legacy === 1) active.push('default');
  }
  return active;
}

export async function isUserOnline(userId) {
  const devices = await listActivePresenceDevices(userId);
  return devices.length > 0;
}

export async function filterOnlineUserIds(userIds) {
  const client = getRedis();
  if (!client || !userIds?.length) return [];
  const online = [];
  for (const id of userIds) {
    if (await isUserOnline(id)) online.push(id);
  }
  return online;
}

export async function setTypingIndicator(threadId, userId, ttlSeconds = 8) {
  const client = getRedis();
  if (!client || !threadId || !userId) return false;
  const key = `${KEYS.typingSetPrefix}${threadId}`;
  await client.sadd(key, userId);
  await client.expire(key, ttlSeconds);
  return true;
}

export async function getTypingUserIds(threadId) {
  const client = getRedis();
  if (!client || !threadId) return [];
  const members = await client.smembers(`${KEYS.typingSetPrefix}${threadId}`);
  return Array.isArray(members) ? members.map(String) : [];
}

/**
 * Viewer membership uses session keys + a set.
 * Blind incr/decr is unreliable across crash/reconnect/multi-device.
 */
export async function getStreamViewers(streamId) {
  const client = getRedis();
  if (!client || !streamId) return 0;
  const setKey = `${KEYS.streamViewersPrefix}${streamId}`;
  const members = await client.smembers(setKey);
  if (!Array.isArray(members) || !members.length) {
    // Legacy counter fallback.
    const raw = await client.get(`${KEYS.streamViewersPrefix}${streamId}:count`);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  let count = 0;
  for (const sessionId of members) {
    const exists = await client.exists(
      `${KEYS.streamViewerSessionPrefix}${streamId}:${sessionId}`,
    );
    if (exists === 1) count += 1;
    else await client.srem(setKey, sessionId);
  }
  return count;
}

export async function joinStreamViewer(streamId, sessionId, ttlSeconds = 90) {
  const client = getRedis();
  if (!client || !streamId || !sessionId) return 0;
  const sid = String(sessionId).slice(0, 160);
  const ttl = Math.min(300, Math.max(30, Number(ttlSeconds) || 90));
  const setKey = `${KEYS.streamViewersPrefix}${streamId}`;
  const sessionKey = `${KEYS.streamViewerSessionPrefix}${streamId}:${sid}`;
  await client.set(sessionKey, '1', { ex: ttl });
  await client.sadd(setKey, sid);
  await client.expire(setKey, ttl + 60);
  return getStreamViewers(streamId);
}

export async function leaveStreamViewer(streamId, sessionId) {
  const client = getRedis();
  if (!client || !streamId || !sessionId) return 0;
  const sid = String(sessionId).slice(0, 160);
  const setKey = `${KEYS.streamViewersPrefix}${streamId}`;
  await client.del(`${KEYS.streamViewerSessionPrefix}${streamId}:${sid}`);
  await client.srem(setKey, sid);
  return getStreamViewers(streamId);
}

/** @deprecated Prefer joinStreamViewer / leaveStreamViewer for idempotent membership. */
export async function incrStreamViewers(streamId, sessionId = `anon_${Date.now()}`) {
  return joinStreamViewer(streamId, sessionId);
}

/** @deprecated Prefer leaveStreamViewer. */
export async function decrStreamViewers(streamId, sessionId) {
  if (sessionId) return leaveStreamViewer(streamId, sessionId);
  return getStreamViewers(streamId);
}
