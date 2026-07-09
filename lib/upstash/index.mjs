import { Redis } from '@upstash/redis';

/** Redis key namespace for InstaCollab */
export const KEYS = {
  handoffQueue: 'ic:handoff:queue',
  uxSignals: 'ic:ux:signals',
  feedPosts: 'ic:feed:posts',
  handoffState: 'ic:handoff:state',
  presencePrefix: 'ic:presence:',
  typingSetPrefix: 'ic:typing:set:',
  streamViewersPrefix: 'ic:stream:viewers:',
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

export async function setUserOnline(userId, ttlSeconds = 90) {
  const client = getRedis();
  if (!client || !userId) return false;
  await client.set(`${KEYS.presencePrefix}${userId}`, '1', { ex: ttlSeconds });
  return true;
}

export async function isUserOnline(userId) {
  const client = getRedis();
  if (!client || !userId) return false;
  const exists = await client.exists(`${KEYS.presencePrefix}${userId}`);
  return exists === 1;
}

export async function filterOnlineUserIds(userIds) {
  const client = getRedis();
  if (!client || !userIds?.length) return [];
  const pipeline = client.pipeline();
  for (const id of userIds) {
    pipeline.exists(`${KEYS.presencePrefix}${id}`);
  }
  const results = await pipeline.exec();
  return userIds.filter((id, index) => results[index] === 1);
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

export async function getStreamViewers(streamId) {
  const client = getRedis();
  if (!client || !streamId) return 0;
  const raw = await client.get(`${KEYS.streamViewersPrefix}${streamId}`);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function incrStreamViewers(streamId) {
  const client = getRedis();
  if (!client || !streamId) return 0;
  return client.incr(`${KEYS.streamViewersPrefix}${streamId}`);
}

export async function decrStreamViewers(streamId) {
  const client = getRedis();
  if (!client || !streamId) return 0;
  const next = await client.decr(`${KEYS.streamViewersPrefix}${streamId}`);
  if (typeof next === 'number' && next < 0) {
    await client.set(`${KEYS.streamViewersPrefix}${streamId}`, 0);
    return 0;
  }
  return typeof next === 'number' ? next : 0;
}
