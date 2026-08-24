/**
 * Persistent Game Center leaderboard (local device + room scores merge).
 */

const STORAGE_KEY = 'unilive.arcade.leaderboard.v1';
const EVENT_NAME = 'arcade-leaderboard-updated';

type LeaderboardBucket = {
  scores: Record<string, number>;
  names: Record<string, string>;
};

function readBucket(): LeaderboardBucket {
  if (typeof localStorage === 'undefined') return { scores: {}, names: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { scores: {}, names: {} };
    const parsed = JSON.parse(raw) as LeaderboardBucket;
    return {
      scores: parsed?.scores && typeof parsed.scores === 'object' ? parsed.scores : {},
      names: parsed?.names && typeof parsed.names === 'object' ? parsed.names : {},
    };
  } catch {
    return { scores: {}, names: {} };
  }
}

function writeBucket(bucket: LeaderboardBucket) {
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

export function recordArcadeLeaderboardScore(
  userId: string,
  displayName: string,
  score: number,
): void {
  const id = String(userId || displayName || '').trim();
  if (!id || !Number.isFinite(score) || score <= 0) return;
  const bucket = readBucket();
  const prev = bucket.scores[id] ?? 0;
  if (score > prev) bucket.scores[id] = Math.floor(score);
  if (displayName) bucket.names[id] = displayName;
  writeBucket(bucket);
}

export function mergeArcadeLeaderboard(
  liveScores: Record<string, number>,
  selfUserId: string,
  selfName: string,
): Array<{ id: string; name: string; score: number }> {
  const bucket = readBucket();
  const merged: Record<string, number> = { ...bucket.scores };
  for (const [id, score] of Object.entries(liveScores || {})) {
    const key = String(id || '').trim();
    if (!key) continue;
    merged[key] = Math.max(merged[key] ?? 0, score);
  }
  if (selfUserId && (liveScores[selfUserId] ?? 0) > 0) {
    bucket.names[selfUserId] = selfName || bucket.names[selfUserId] || 'You';
  }
  return Object.entries(merged)
    .map(([id, score]) => ({
      id,
      name: id === selfUserId ? selfName || 'You' : bucket.names[id] || id.slice(0, 10),
      score,
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

export function subscribeArcadeLeaderboard(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => onChange();
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
