/**
 * Slow-network policy: UI never waits on the internet.
 * All network work is short-timeout + background-only.
 */

/** Max wait for auth session read (local storage usually; network refresh must not hang). */
export const NET_AUTH_MS = 1_200;

/** Max wait for a single API / Supabase query used by background sync. */
export const NET_API_MS = 4_000;

/** Max wait for profile / app-state hydrate in background. */
export const NET_HYDRATE_MS = 3_000;

/** Soft cap for feed/inbox pulls. */
export const NET_FEED_MS = 5_000;

export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'request'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
}

/** fetch with abort — fails fast on very slow networks. */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  ms: number,
  label = 'fetch',
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  try {
    const parentSignal = init?.signal;
    if (parentSignal) {
      if (parentSignal.aborted) controller.abort();
      else parentSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`${label} timed out after ${ms}ms`);
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Run work in background; never reject to caller. */
export function backgroundNet(label: string, fn: () => Promise<unknown>): void {
  queueMicrotask(() => {
    void fn().catch((err) => {
      if (import.meta.env.DEV) {
        console.warn(`[net:${label}]`, err);
      }
    });
  });
}
