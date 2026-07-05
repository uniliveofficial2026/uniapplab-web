/**
 * Zero-delay task scheduling for the whole app.
 * Coalesces duplicate keys into one microtask — no setTimeout lag.
 */

const pending = new Map<string, () => void>();
let flushScheduled = false;

function flushPending(): void {
  flushScheduled = false;
  const jobs = [...pending.values()];
  pending.clear();
  for (const job of jobs) {
    try {
      job();
    } catch (err) {
      console.warn('[instant-task] job failed:', err);
    }
  }
}

/** Run `fn` on the next microtask (0ms delay). Same `key` replaces prior pending work. */
export function scheduleInstant(key: string, fn: () => void): void {
  pending.set(key, fn);
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(flushPending);
}

/** Fire-and-forget async work with no artificial delay. */
export function runInstant(fn: () => void | Promise<void>): void {
  queueMicrotask(() => {
    void Promise.resolve(fn()).catch((err) => {
      console.warn('[instant-task] async failed:', err);
    });
  });
}

/** Prefetch a dynamic import immediately (no idle wait). */
export function preloadInstant(factory: () => Promise<unknown>): void {
  runInstant(() => {
    void factory().catch(() => undefined);
  });
}
