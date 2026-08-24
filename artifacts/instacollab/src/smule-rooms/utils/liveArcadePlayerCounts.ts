/**
 * Live arcade player counts — seed popularity + real daily plays + active sessions.
 */

type ArcadeCountBucket = {
  day: string;
  plays: Record<string, number>;
  active: Record<string, string[]>;
};

const STORAGE_KEY = 'unilive.arcade.playerCounts.v1';
const EVENT_NAME = 'arcade-player-counts-updated';

function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function readBucket(): ArcadeCountBucket {
  if (typeof localStorage === 'undefined') return { day: todayKey(), plays: {}, active: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { day: todayKey(), plays: {}, active: {} };
    const parsed = JSON.parse(raw) as ArcadeCountBucket;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.day !== 'string') {
      return { day: todayKey(), plays: {}, active: {} };
    }
    const day = todayKey();
    return {
      day,
      plays: parsed.day === day && parsed.plays && typeof parsed.plays === 'object' ? parsed.plays : {},
      active: parsed.active && typeof parsed.active === 'object' ? parsed.active : {},
    };
  } catch {
    return { day: todayKey(), plays: {}, active: {} };
  }
}

function writeBucket(bucket: ArcadeCountBucket) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bucket));
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }
}

export function recordArcadeGamePlay(gameId: string, userId?: string): void {
  const id = String(gameId || '').trim();
  if (!id) return;
  const bucket = readBucket();
  bucket.plays[id] = (bucket.plays[id] ?? 0) + 1;
  if (userId) {
    const active = new Set(bucket.active[id] ?? []);
    active.add(userId);
    bucket.active[id] = Array.from(active);
  }
  writeBucket(bucket);
}

export function setArcadeGameActive(gameId: string, userId: string, active: boolean): void {
  const id = String(gameId || '').trim();
  const uid = String(userId || '').trim();
  if (!id || !uid) return;
  const bucket = readBucket();
  const set = new Set(bucket.active[id] ?? []);
  if (active) set.add(uid);
  else set.delete(uid);
  if (set.size) bucket.active[id] = Array.from(set);
  else delete bucket.active[id];
  writeBucket(bucket);
}

export function getLiveArcadePlayerCount(
  gameId: string,
  options?: { seed?: number; roomActivePlayers?: number },
): number {
  const id = String(gameId || '').trim();
  if (!id) return 0;
  const bucket = readBucket();
  const seed = Math.max(0, options?.seed ?? 0);
  const todayPlays = bucket.plays[id] ?? 0;
  const activeNow = (bucket.active[id]?.length ?? 0) + Math.max(0, options?.roomActivePlayers ?? 0);
  return Math.max(0, seed + todayPlays + activeNow);
}

export function subscribeArcadePlayerCounts(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => onChange();
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
