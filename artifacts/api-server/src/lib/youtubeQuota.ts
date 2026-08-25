import { getRedis, isUpstashConfigured } from "./upstash";

/** In-memory fallback when Redis is cold / unavailable (per serverless instance). */
const memory = new Map<string, { expiresAt: number; value: string }>();

export type YoutubeCacheEnvelope<T> = {
  data: T;
  cachedAt: number;
  source: "live" | "cache" | "fallback";
  quotaExceeded?: boolean;
};

export function youtubeApiKeys(): string[] {
  const multi = String(process.env.YOUTUBE_API_KEYS ?? "")
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const primary =
    process.env.YOUTUBE_API_KEY?.trim() ||
    process.env.VITE_YOUTUBE_API_KEY?.trim() ||
    "";
  const keys = [...multi];
  if (primary && !keys.includes(primary)) keys.unshift(primary);
  return keys;
}

export function youtubeApiKey(): string | null {
  return youtubeApiKeys()[0] ?? null;
}

export function isYoutubeQuotaError(status: number, body: unknown): boolean {
  if (status !== 403 && status !== 429) return false;
  const message =
    typeof body === "object" &&
    body &&
    "error" in body &&
    typeof (body as { error?: { message?: string } }).error?.message === "string"
      ? (body as { error: { message: string } }).error.message
      : typeof body === "object" &&
          body &&
          "message" in body &&
          typeof (body as { message?: string }).message === "string"
        ? (body as { message: string }).message
        : "";
  return /quota exceeded/i.test(message) || /quotaMetric/i.test(message);
}

/** Parse description timestamps into chapters (YouTube-style `0:00 Title` lines). */
export function parseYoutubeChapters(
  description: string | undefined,
): Array<{ startSeconds: number; label: string }> {
  if (!description?.trim()) return [];
  const chapters: Array<{ startSeconds: number; label: string }> = [];
  const seen = new Set<number>();
  for (const raw of description.split(/\r?\n/)) {
    const match = /^\s*((?:\d{1,2}:)?\d{1,2}:\d{2})\s+[-–—]?\s*(.+?)\s*$/.exec(raw);
    if (!match) continue;
    const stamp = match[1] ?? "";
    const label = (match[2] ?? "").trim();
    if (!label) continue;
    const parts = stamp.split(":").map((part) => Number.parseInt(part, 10));
    if (parts.some((part) => !Number.isFinite(part))) continue;
    let startSeconds = 0;
    if (parts.length === 3) startSeconds = (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
    else startSeconds = (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
    if (seen.has(startSeconds)) continue;
    seen.add(startSeconds);
    chapters.push({ startSeconds, label: label.slice(0, 120) });
  }
  if (chapters.length < 2) return [];
  chapters.sort((a, b) => a.startSeconds - b.startSeconds);
  return chapters;
}

export function parseIsoDurationSeconds(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

export function youtubeThumbnailUrl(
  videoId: string,
  thumbs?: {
    medium?: { url?: string };
    high?: { url?: string };
    default?: { url?: string };
    maxres?: { url?: string };
  },
): string {
  return (
    thumbs?.maxres?.url ||
    thumbs?.high?.url ||
    thumbs?.medium?.url ||
    thumbs?.default?.url ||
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  );
}

/** Seed ids used only when Search quota is exhausted and Redis has no prior live cache. */
export const LIVE_SEED_VIDEO_IDS = [
  "qBUVTQwPWn8",
  "jOZV16EbR78",
  "RPp7rhYuOhg",
  "jfKfPfyJRdk",
  "5qap5aO4i9A",
  "DWcJFLf2T8U",
  "4xDzrJKXOOY",
  "7NOSDKbWYgw",
] as const;

const CACHE_PREFIX = "youtube:v1:";

export async function getYoutubeCache<T>(key: string): Promise<T | null> {
  const full = `${CACHE_PREFIX}${key}`;
  const now = Date.now();
  const local = memory.get(full);
  if (local && local.expiresAt > now) {
    try {
      return JSON.parse(local.value) as T;
    } catch {
      memory.delete(full);
    }
  }

  if (!isUpstashConfigured()) return null;
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get<string>(full);
    if (!raw) return null;
    const text = typeof raw === "string" ? raw : JSON.stringify(raw);
    memory.set(full, { expiresAt: now + 60_000, value: text });
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function setYoutubeCache(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  const full = `${CACHE_PREFIX}${key}`;
  const text = JSON.stringify(value);
  memory.set(full, { expiresAt: Date.now() + ttlSeconds * 1000, value: text });
  if (!isUpstashConfigured()) return;
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(full, text, { ex: ttlSeconds });
  } catch {
    /* ignore redis write failures */
  }
}

/** Fetch YouTube Data API with optional key rotation on quota / auth failures. */
export async function youtubeFetchJson(
  buildUrl: (apiKey: string) => string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const keys = youtubeApiKeys();
  if (keys.length === 0) {
    return { ok: false, status: 503, body: { error: "youtube_not_configured" } };
  }

  let last: { ok: boolean; status: number; body: unknown } = {
    ok: false,
    status: 503,
    body: { error: "youtube_not_configured" },
  };

  for (const key of keys) {
    const upstream = await fetch(buildUrl(key), init);
    const body = (await upstream.json().catch(() => ({}))) as unknown;
    last = { ok: upstream.ok, status: upstream.status, body };
    if (upstream.ok) return last;
    if (!isYoutubeQuotaError(upstream.status, body) && upstream.status !== 400) {
      return last;
    }
    // try next key on quota
    if (!isYoutubeQuotaError(upstream.status, body)) return last;
  }
  return last;
}
