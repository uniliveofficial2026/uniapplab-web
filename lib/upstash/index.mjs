import { Redis } from '@upstash/redis';

/** Redis key namespace for InstaCollab */
export const KEYS = {
  handoffQueue: 'ic:handoff:queue',
  uxSignals: 'ic:ux:signals',
  feedPosts: 'ic:feed:posts',
  handoffState: 'ic:handoff:state',
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
  if (!entry.id) {
    entry.id = `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
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
