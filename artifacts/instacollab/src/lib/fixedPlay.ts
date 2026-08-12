/**
 * Fixed-duration play — timer cannot be cancelled by React remounts.
 * `force` complete only after the timer fires (or explicit reset for a new document load).
 */

export const LOCKED_VIDEO_PLAY_MS = 5042;

type Entry = {
  timer: number;
  onComplete: () => void;
  startedAt: number;
};

const active = new Map<string, Entry>();
const done = new Set<string>();

export type FixedPlayHandle = { active: boolean; done: boolean };

export function armFixedPlay(options: {
  key: string;
  playMs?: number;
  onStart?: () => void;
  onComplete: () => void;
}): FixedPlayHandle {
  const playMs = options.playMs ?? LOCKED_VIDEO_PLAY_MS;

  if (done.has(options.key)) {
    return { active: false, done: true };
  }

  const existing = active.get(options.key);
  if (existing) {
    existing.onComplete = options.onComplete;
    return { active: true, done: false };
  }

  options.onStart?.();

  const entry: Entry = {
    startedAt: Date.now(),
    onComplete: options.onComplete,
    timer: 0,
  };

  entry.timer = window.setTimeout(() => {
    active.delete(options.key);
    done.add(options.key);
    entry.onComplete();
  }, playMs);

  active.set(options.key, entry);
  return { active: true, done: false };
}

/** Remaining ms for an active play (0 if none). */
export function fixedPlayRemainingMs(key: string): number {
  const entry = active.get(key);
  if (!entry) return 0;
  const playMs = LOCKED_VIDEO_PLAY_MS;
  return Math.max(0, playMs - (Date.now() - entry.startedAt));
}

export function resetFixedPlay(key: string): void {
  const entry = active.get(key);
  if (entry) {
    window.clearTimeout(entry.timer);
    active.delete(key);
  }
  done.delete(key);
}

export function isFixedPlayDone(key: string): boolean {
  return done.has(key);
}

export function isFixedPlayActive(key: string): boolean {
  return active.has(key);
}

/** When play is already done, run cb now; if active, replace onComplete; else arm. */
export function whenFixedPlayComplete(
  key: string,
  playMs: number,
  onComplete: () => void,
  onStart?: () => void,
): void {
  if (done.has(key)) {
    onComplete();
    return;
  }
  armFixedPlay({ key, playMs, onStart, onComplete });
}
