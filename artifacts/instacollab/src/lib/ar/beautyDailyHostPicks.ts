/**
 * Daily host beauty picks — ranks looks/effects hosts apply most often today.
 * Used by the beauty panel Popular tab.
 */

export type BeautyHostPickKind = 'preset' | 'makeup' | 'sticker' | 'filter';

export type BeautyHostPick = {
  kind: BeautyHostPickKind;
  id: string;
  label: string;
  cover?: string;
  count: number;
};

type DayBucket = {
  day: string;
  picks: Record<string, { kind: BeautyHostPickKind; id: string; label: string; cover?: string; count: number }>;
};

const STORAGE_KEY = 'unilive.beauty.hostPicks.v1';

function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function pickKey(kind: BeautyHostPickKind, id: string): string {
  return `${kind}:${id}`;
}

function readBucket(): DayBucket {
  if (typeof localStorage === 'undefined') return { day: todayKey(), picks: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { day: todayKey(), picks: {} };
    const parsed = JSON.parse(raw) as DayBucket;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.day !== 'string') {
      return { day: todayKey(), picks: {} };
    }
    if (parsed.day !== todayKey()) return { day: todayKey(), picks: {} };
    return {
      day: parsed.day,
      picks: parsed.picks && typeof parsed.picks === 'object' ? parsed.picks : {},
    };
  } catch {
    return { day: todayKey(), picks: {} };
  }
}

function writeBucket(bucket: DayBucket) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bucket));
  } catch {
    /* quota / private mode */
  }
}

export function recordBeautyHostPick(input: {
  kind: BeautyHostPickKind;
  id: string;
  label: string;
  cover?: string | null;
}): void {
  const id = String(input.id || '').trim();
  const label = String(input.label || '').trim();
  if (!id || !label || id === 'none' || label === 'None') return;

  const bucket = readBucket();
  const key = pickKey(input.kind, id);
  const previous = bucket.picks[key];
  bucket.picks[key] = {
    kind: input.kind,
    id,
    label,
    cover: input.cover || previous?.cover || undefined,
    count: (previous?.count ?? 0) + 1,
  };
  writeBucket(bucket);
}

export function getDailyPopularBeautyPicks(limit = 12): BeautyHostPick[] {
  const bucket = readBucket();
  return Object.values(bucket.picks)
    .filter((row) => row.count > 0 && row.id && row.label)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, Math.max(1, limit))
    .map((row) => ({
      kind: row.kind,
      id: row.id,
      label: row.label,
      cover: row.cover,
      count: row.count,
    }));
}
