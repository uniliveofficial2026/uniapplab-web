/**
 * Shared Upstash REST helpers for Edge Functions.
 * Mirrors lib/upstash for presence / typing / stream viewers.
 */
function env(name: string): string {
  return String(Deno.env.get(name) || "").trim();
}

export function isUpstashConfigured(): boolean {
  return Boolean(env("UPSTASH_REDIS_REST_URL") && env("UPSTASH_REDIS_REST_TOKEN"));
}

async function redis(command: unknown[]): Promise<unknown> {
  const url = env("UPSTASH_REDIS_REST_URL");
  const token = env("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token) throw new Error("upstash_not_configured");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`upstash ${res.status}: ${text}`);
  }
  const body = (await res.json()) as { result?: unknown };
  return body.result;
}

const onlineKey = (userId: string) => `presence:online:${userId}`;
const typingKey = (threadId: string) => `chat:typing:${threadId}`;
const viewersKey = (streamId: string) => `stream:viewers:${streamId}`;

export async function setUserOnline(userId: string, ttlSeconds: number): Promise<void> {
  await redis(["SET", onlineKey(userId), "1", "EX", String(ttlSeconds)]);
}

export async function isUserOnline(userId: string): Promise<boolean> {
  const v = await redis(["EXISTS", onlineKey(userId)]);
  return Number(v) === 1;
}

export async function filterOnlineUserIds(ids: string[]): Promise<string[]> {
  const unique = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).slice(0, 100);
  if (!unique.length) return [];
  const pipeline = unique.map((id) => ["EXISTS", onlineKey(id)]);
  const url = env("UPSTASH_REDIS_REST_URL");
  const token = env("UPSTASH_REDIS_REST_TOKEN");
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(pipeline),
  });
  if (!res.ok) return [];
  const body = (await res.json()) as Array<{ result?: unknown }>;
  return unique.filter((_, i) => Number(body[i]?.result) === 1);
}

export async function setTypingIndicator(threadId: string, userId: string): Promise<void> {
  const key = typingKey(threadId);
  await redis(["ZADD", key, String(Date.now()), userId]);
  await redis(["EXPIRE", key, "15"]);
}

export async function getTypingUserIds(threadId: string): Promise<string[]> {
  const key = typingKey(threadId);
  const cutoff = Date.now() - 12_000;
  await redis(["ZREMRANGEBYSCORE", key, "-inf", String(cutoff)]);
  const members = (await redis(["ZRANGE", key, "0", "-1"])) as string[] | null;
  return Array.isArray(members) ? members : [];
}

export async function getStreamViewers(streamId: string): Promise<number> {
  const v = await redis(["GET", viewersKey(streamId)]);
  return Math.max(0, Number(v) || 0);
}

export async function incrStreamViewers(streamId: string): Promise<number> {
  const v = await redis(["INCR", viewersKey(streamId)]);
  await redis(["EXPIRE", viewersKey(streamId), "86400"]);
  return Math.max(0, Number(v) || 0);
}

export async function decrStreamViewers(streamId: string): Promise<number> {
  const cur = await getStreamViewers(streamId);
  if (cur <= 0) {
    await redis(["SET", viewersKey(streamId), "0", "EX", "86400"]);
    return 0;
  }
  const v = await redis(["DECR", viewersKey(streamId)]);
  return Math.max(0, Number(v) || 0);
}
