import {
  greedyTapHealthUrl,
  isGreedyTapReadyPayload,
  resolveGreedyTapRealtimeOrigin,
} from './config';

/** Render free dynos sleep after ~15m idle — ping under that while Greedy is live. */
const KEEP_ALIVE_MS = 8 * 60 * 1000;
const WAKE_RETRY_MS = [0, 800, 2500, 6000, 12_000] as const;

let keepAliveTimer = 0;
let wakeInFlight: Promise<boolean> | null = null;
let lastWakeOkAt = 0;

function sameOriginGreedyHealthUrl(): string {
  if (typeof window === 'undefined') return greedyTapHealthUrl();
  // Edge worker proxies this to GAME_ORIGIN /api/health (wakes Render).
  return `${window.location.origin}/games/greedy-slot/healthz`;
}

function directRealtimeHealthUrl(): string {
  try {
    return new URL('/api/health', resolveGreedyTapRealtimeOrigin()).toString();
  } catch {
    return '';
  }
}

async function pingOnce(url: string, timeoutMs = 25_000): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json')) {
      // Healthz should always be JSON; HTML means wrong upstream.
      return false;
    }
    const body = await res.json().catch(() => null);
    return isGreedyTapReadyPayload(body, url) || (body as { status?: string })?.status === 'ok';
  } catch {
    return false;
  }
}

/** One wake attempt: same-origin healthz first, then direct Render origin. */
export async function wakeGreedyRealtimeOnce(): Promise<boolean> {
  if (wakeInFlight) return wakeInFlight;
  wakeInFlight = (async () => {
    const primary = sameOriginGreedyHealthUrl();
    if (await pingOnce(primary)) {
      lastWakeOkAt = Date.now();
      return true;
    }
    const direct = directRealtimeHealthUrl();
    if (direct && (await pingOnce(direct, 45_000))) {
      lastWakeOkAt = Date.now();
      return true;
    }
    return false;
  })().finally(() => {
    wakeInFlight = null;
  });
  return wakeInFlight;
}

/**
 * Fire-and-forget wake with retries so opening Greedy does not wait on a cold Render dyno.
 * Call when the user opens Greedy / session becomes active.
 */
export function wakeGreedyRealtimeInBackground(): void {
  if (typeof window === 'undefined') return;
  for (const delay of WAKE_RETRY_MS) {
    window.setTimeout(() => {
      void wakeGreedyRealtimeOnce();
    }, delay);
  }
}

/**
 * Keep the Render realtime service warm for the lifetime of an active Greedy session
 * (fullscreen or floating PiP). Safe to call repeatedly — only one interval runs.
 */
export function startGreedyRealtimeKeepAlive(): () => void {
  if (typeof window === 'undefined') return () => {};

  wakeGreedyRealtimeInBackground();

  if (!keepAliveTimer) {
    keepAliveTimer = window.setInterval(() => {
      void wakeGreedyRealtimeOnce();
    }, KEEP_ALIVE_MS);
  }

  return () => {
    if (keepAliveTimer) {
      window.clearInterval(keepAliveTimer);
      keepAliveTimer = 0;
    }
  };
}

export function getGreedyRealtimeLastWakeOkAt(): number {
  return lastWakeOkAt;
}
