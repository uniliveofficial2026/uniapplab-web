import { Redis } from '@upstash/redis';

/** Redis key namespace for InstaCollab — ephemeral/cache only (not source of truth). */
export const KEYS = {
  handoffQueue: 'ic:handoff:queue',
  uxSignals: 'ic:ux:signals',
  feedPosts: 'ic:feed:posts',
  handoffState: 'ic:handoff:state',
  onlinePrefix: 'ic:online:',
  streamViewersPrefix: 'ic:stream:viewers:',
  typingPrefix: 'ic:typing:',
  sessionPrefix: 'ic:session:',
};

const DEFAULT_ONLINE_TTL_SEC = 90;
const DEFAULT_TYPING_TTL_SEC = 8;
const DEFAULT_SESSION_TTL_SEC = 3600;

export function onlineKey(userId) {
  return `${KEYS.onlinePrefix}${userId}`;
}

export function streamViewersKey(streamId) {
  return `${KEYS.streamViewersPrefix}${streamId}`;
}

export function typingKey(threadId) {
  return `${KEYS.typingPrefix}${threadId}`;
}

export function sessionKey(tokenHash) {
  return `${KEYS.sessionPrefix}${tokenHash}`;
}

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
    t: Date.now(),
    status: 'pending',
    priority: 3,
    ...task,
    id: task.id || `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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

export async function popUxSignals(limit = 200) {
  const client = getRedis();
  if (!client) return [];
  const raw = await client.lrange(KEYS.uxSignals, 0, limit - 1);
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

export async function rewriteHandoffQueue(tasks) {
  const client = getRedis();
  if (!client) return false;
  const pipeline = client.pipeline();
  pipeline.del(KEYS.handoffQueue);
  if (tasks.length) {
    pipeline.rpush(
      KEYS.handoffQueue,
      ...tasks.map((t) => JSON.stringify(t)),
    );
  }
  await pipeline.exec();
  return true;
}

/** Online presence — TTL heartbeat per user. */
export async function setUserOnline(userId, ttlSeconds = DEFAULT_ONLINE_TTL_SEC) {
  const client = getRedis();
  if (!client || !userId) return false;
  await client.set(onlineKey(userId), String(Date.now()), { ex: ttlSeconds });
  return true;
}

export async function isUserOnline(userId) {
  const client = getRedis();
  if (!client || !userId) return false;
  return Boolean(await client.get(onlineKey(userId)));
}

export async function filterOnlineUserIds(userIds) {
  const client = getRedis();
  if (!client || !userIds?.length) return [];
  const pipeline = client.pipeline();
  for (const id of userIds) pipeline.get(onlineKey(id));
  const results = await pipeline.exec();
  return userIds.filter((_, i) => Boolean(results[i]));
}

/** Livestream viewer count — INCR/DECR on join/leave. */
export async function incrStreamViewers(streamId) {
  const client = getRedis();
  if (!client || !streamId) return null;
  return client.incr(streamViewersKey(streamId));
}

export async function decrStreamViewers(streamId) {
  const client = getRedis();
  if (!client || !streamId) return null;
  const count = await client.decr(streamViewersKey(streamId));
  if (typeof count === 'number' && count < 0) {
    await client.set(streamViewersKey(streamId), 0);
    return 0;
  }
  return count;
}

export async function getStreamViewers(streamId) {
  const client = getRedis();
  if (!client || !streamId) return 0;
  const raw = await client.get(streamViewersKey(streamId));
  const n = Number(raw ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Typing indicators — hash of userId → expiresAt ms, refreshed on each keystroke. */
export async function setTypingIndicator(threadId, userId, ttlSeconds = DEFAULT_TYPING_TTL_SEC) {
  const client = getRedis();
  if (!client || !threadId || !userId) return false;
  const key = typingKey(threadId);
  const now = Date.now();
  const expiresAt = now + ttlSeconds * 1000;
  const existing = (await client.hgetall(key)) || {};
  const next = {};
  for (const [uid, exp] of Object.entries(existing)) {
    if (Number(exp) > now) next[uid] = exp;
  }
  next[userId] = String(expiresAt);
  await client.hset(key, next);
  await client.expire(key, ttlSeconds + 2);
  return true;
}

export async function getTypingUserIds(threadId) {
  const client = getRedis();
  if (!client || !threadId) return [];
  const key = typingKey(threadId);
  const existing = (await client.hgetall(key)) || {};
  const now = Date.now();
  const active = Object.entries(existing)
    .filter(([, exp]) => Number(exp) > now)
    .map(([uid]) => uid);
  if (active.length !== Object.keys(existing).length) {
    const pruned = Object.fromEntries(
      Object.entries(existing).filter(([, exp]) => Number(exp) > now),
    );
    if (Object.keys(pruned).length) await client.hset(key, pruned);
    else await client.del(key);
  }
  return active;
}

/** Optional thin session cache keyed by token hash. */
export async function cacheSession(tokenHash, payload, ttlSeconds = DEFAULT_SESSION_TTL_SEC) {
  const client = getRedis();
  if (!client || !tokenHash) return false;
  await client.set(sessionKey(tokenHash), JSON.stringify(payload), { ex: ttlSeconds });
  return true;
}

export async function getCachedSession(tokenHash) {
  const client = getRedis();
  if (!client || !tokenHash) return null;
  const raw = await client.get(sessionKey(tokenHash));
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

export async function clearCachedSession(tokenHash) {
  const client = getRedis();
  if (!client || !tokenHash) return false;
  await client.del(sessionKey(tokenHash));
  return true;
}
