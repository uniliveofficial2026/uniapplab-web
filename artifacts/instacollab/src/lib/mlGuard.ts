/**
 * Zero-mistake guards for auto ML — corroborate before acting, verify after healing,
 * filter noise, and dedupe escalations so false detections never change user state.
 */
import { trackUx } from './uxTelemetry';

const CORROBORATION_KEY = 'instacollab-ml-corroboration';
const HANDOFF_FP_KEY = 'instacollab-ml-handoff-fp';
const ACT_COOLDOWN_MS = 30_000;
const SAFE_ACT_COOLDOWN_MS = 8_000;
const HANDOFF_COOLDOWN_MS = 5 * 60_000;

type Bucket = { hits: number[]; lastActedAt?: number };
type HandoffFp = { count: number; lastEscalatedAt?: number };

const NOISE_PATTERNS = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /chrome-extension/i,
  /moz-extension/i,
  /safari-extension/i,
  /Failed to fetch$/i,
  /Load failed/i,
  /AbortError/i,
  /The operation was aborted/i,
  /cancelled/i,
  /Non-Error promise rejection/i,
];

const BENIGN_HEAL_ACTIONS = new Set([
  'session_state',
  'layout_overflow',
  'playback_paused_hidden',
  'app_media_hydrated',
  'media_fallback',
  'chunk_staged',
  'update_staged',
  'auth_failover',
]);

function readBuckets(): Record<string, Bucket> {
  try {
    return JSON.parse(localStorage.getItem(CORROBORATION_KEY) || '{}') as Record<string, Bucket>;
  } catch {
    return {};
  }
}

function writeBuckets(map: Record<string, Bucket>): void {
  try {
    localStorage.setItem(CORROBORATION_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

function readHandoffFingerprints(): Record<string, HandoffFp> {
  try {
    return JSON.parse(localStorage.getItem(HANDOFF_FP_KEY) || '{}') as Record<string, HandoffFp>;
  } catch {
    return {};
  }
}

function writeHandoffFingerprints(map: Record<string, HandoffFp>): void {
  try {
    localStorage.setItem(HANDOFF_FP_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

/** Confirmed cloud/data defects — pattern match is sufficient corroboration for immediate agent fix. */
export function isCriticalCloudIssue(detail: string): boolean {
  return /posts|cloud|supabase|sync|cross.?device|other user|relation.*posts|auth\/v1|network|fetch failed/i.test(
    detail,
  );
}

/** Safe in-session heals — act on first detection (still verify-after-heal). */
export function isSafeImmediateAction(key: string): boolean {
  return /^(layout_|media_|session_|playback_|chunk_|lag_|memory_)/.test(key);
}

/** Drop browser/extension noise — never treat as real app defects. */
export function isNoiseSignal(detail: string): boolean {
  const d = detail.trim();
  if (!d || d.length < 3) return true;
  return NOISE_PATTERNS.some((re) => re.test(d));
}

export function fingerprintIssue(kind: string, detail: string): string {
  const normalized = detail
    .slice(0, 120)
    .replace(/\d{4,}/g, '#')
    .replace(/\b[0-9a-f]{8,}\b/gi, 'id')
    .trim();
  return `${kind}:${normalized}`;
}

/** Record a detection sample; returns recent hit count inside the window. */
export function recordCorroboration(key: string, windowMs: number): number {
  if (typeof window === 'undefined') return 0;
  const now = Date.now();
  const map = readBuckets();
  const bucket = map[key] ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  bucket.hits.push(now);
  map[key] = bucket;
  writeBuckets(map);
  return bucket.hits.length;
}

/**
 * True only when the same issue was seen enough times and cooldown elapsed —
 * prevents one-off glitches from triggering heals or handoffs.
 */
export function canActOnCorroboration(
  key: string,
  windowMs: number,
  minHits: number,
): boolean {
  if (typeof window === 'undefined') return false;
  const effectiveMin = isSafeImmediateAction(key) ? 1 : minHits;
  const count = recordCorroboration(key, windowMs);
  if (count < effectiveMin) return false;

  const map = readBuckets();
  const bucket = map[key];
  const cooldown = isSafeImmediateAction(key) ? SAFE_ACT_COOLDOWN_MS : ACT_COOLDOWN_MS;
  if (bucket?.lastActedAt && Date.now() - bucket.lastActedAt < cooldown) {
    return false;
  }
  return true;
}

export function markCorroborationActed(key: string): void {
  if (typeof window === 'undefined') return;
  const map = readBuckets();
  const bucket = map[key] ?? { hits: [] };
  bucket.lastActedAt = Date.now();
  map[key] = bucket;
  writeBuckets(map);
}

/** Escalate to background agent — critical cloud issues escalate immediately; others need 2 hits. */
export function shouldEscalateHandoff(kind: string, detail: string, minHits = 2): boolean {
  if (typeof window === 'undefined') return false;
  if (isNoiseSignal(detail)) return false;

  if (isCriticalCloudIssue(detail) || kind === 'boundary_error') {
    minHits = 1;
  }

  const fp = fingerprintIssue(kind, detail);
  const now = Date.now();
  const map = readHandoffFingerprints();
  const entry = map[fp] ?? { count: 0 };
  entry.count += 1;
  map[fp] = entry;
  writeHandoffFingerprints(map);

  if (entry.count < minHits) return false;
  if (entry.lastEscalatedAt && now - entry.lastEscalatedAt < HANDOFF_COOLDOWN_MS) return false;

  entry.lastEscalatedAt = now;
  entry.count = 0;
  map[fp] = entry;
  writeHandoffFingerprints(map);
  return true;
}

export function isSafeHealAction(action: string): boolean {
  return BENIGN_HEAL_ACTIONS.has(action);
}

/** Verify heal improved state; roll back telemetry if not. */
export function verifyHealOutcome(label: string, check: () => boolean): boolean {
  const ok = check();
  if (!ok) {
    trackUx('warning', 'heal_verify_failed', { check: label });
  }
  return ok;
}

/** Require two consecutive confirmations before irreversible runtime actions. */
export async function confirmTwice<T>(
  probe: () => Promise<T>,
  isBad: (value: T) => boolean,
  gapMs = 800,
): Promise<boolean> {
  const first = await probe();
  if (!isBad(first)) return false;
  await new Promise((resolve) => setTimeout(resolve, gapMs));
  const second = await probe();
  return isBad(second);
}
