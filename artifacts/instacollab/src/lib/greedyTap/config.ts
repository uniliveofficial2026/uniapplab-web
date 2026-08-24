import { appBasePath } from '../appShellRoutes';
import { isDemoContentEnabled } from '../demoContentPolicy';

/** Same-origin path for the Greedy Tap SPA shell on UniLive.
 * Use explicit index.html — Vite's SPA fallback steals `/games/greedy-slot/`.
 */
const GREEDY_TAP_GAME_SUBPATH = '/games/greedy-slot/index.html';

/** Production realtime backend (Socket.IO WebSocket). Vercel rewrites can't upgrade WS. */
const DEFAULT_GREEDY_TAP_REALTIME_ORIGIN = 'https://uniapplab-greedy-tap.onrender.com';

function normalizeTrailingSlash(url: string): string {
  // Keep explicit index.html URLs intact (needed for Vite public/ SPA conflict).
  if (/\/index\.html\/?$/i.test(url)) {
    return url.replace(/\/index\.html\/?$/i, '/index.html');
  }
  return url.replace(/\/?$/, '/');
}

function joinAppPath(subpath: string): string {
  const base = appBasePath();
  return `${base}${subpath}`.replace(/\/{2,}/g, '/');
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

/**
 * Origin for Socket.IO realtime.
 * - Dev: same-origin (Vite proxies `/socket.io` with `ws: true`).
 * - Prod: direct Render origin so the browser gets a real WebSocket (not Vercel HTTP polling).
 */
export function resolveGreedyTapRealtimeOrigin(): string {
  const override = (
    (import.meta.env.VITE_GREEDY_TAP_REALTIME_ORIGIN as string | undefined) ||
    (import.meta.env.VITE_GREEDY_TAP_ORIGIN as string | undefined) ||
    ''
  ).trim();
  if (override) return stripTrailingSlash(override);

  if (import.meta.env.DEV) {
    if (typeof window !== 'undefined') return window.location.origin;
    return 'http://127.0.0.1:3000';
  }

  return DEFAULT_GREEDY_TAP_REALTIME_ORIGIN;
}

/** Iframe URL with `rt` query so the game opens a direct realtime Socket.IO connection. */
export function resolveGreedyTapAppUrl(): string {
  const override = (import.meta.env.VITE_GREEDY_TAP_APP_URL as string | undefined)?.trim();
  let base: string;
  if (override) {
    base = normalizeTrailingSlash(override);
  } else if (typeof window !== 'undefined') {
    // Same-origin shell everywhere (incl. localhost:5173/greedy-tap) for instant load.
    base = normalizeTrailingSlash(`${window.location.origin}${joinAppPath(GREEDY_TAP_GAME_SUBPATH)}`);
  } else if (import.meta.env.DEV) {
    base = normalizeTrailingSlash(`http://localhost:5173${GREEDY_TAP_GAME_SUBPATH}`);
  } else {
    const origin = (import.meta.env.VITE_APP_ORIGIN || 'https://app.uniapplab.com').replace(/\/$/, '');
    base = normalizeTrailingSlash(`${origin}${joinAppPath(GREEDY_TAP_GAME_SUBPATH)}`);
  }

  try {
    const url = new URL(
      base,
      typeof window !== 'undefined' ? window.location.origin : 'https://app.uniapplab.com',
    );
    const rt = resolveGreedyTapRealtimeOrigin();
    if (rt) url.searchParams.set('rt', rt);
    // Mark live session for the game shell.
    url.searchParams.set('live', '1');
    if (!isDemoContentEnabled()) {
      url.searchParams.set('demo', '0');
    }
    return url.toString();
  } catch {
    return base;
  }
}

/**
 * Readiness probe.
 * - Dev: Greedy Express `/api/health` (proxied via Vite or direct :3000).
 * - Prod: Greedy `/api/items` proxied on UniLive (UniLive's own `/api/health` is different).
 */
export function greedyTapHealthUrl(): string {
  const override = (import.meta.env.VITE_GREEDY_TAP_APP_URL as string | undefined)?.trim();
  if (override) {
    return new URL('/api/health', override).toString();
  }

  if (typeof window !== 'undefined') {
    if (import.meta.env.DEV) {
      return `${window.location.origin}${joinAppPath('/api/health')}`.replace(/([^:]\/)\/+/g, '$1');
    }
    return `${window.location.origin}${joinAppPath('/api/items')}`.replace(/([^:]\/)\/+/g, '$1');
  }

  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:3000/api/health';
  }

  const origin = (import.meta.env.VITE_APP_ORIGIN || 'https://app.uniapplab.com').replace(/\/$/, '');
  return `${origin}/api/items`;
}

export function isGreedyTapReadyPayload(body: unknown, url: string): boolean {
  if (!body) return false;
  if (url.includes('/api/items')) {
    return Array.isArray(body) && body.length > 0;
  }
  if (typeof body !== 'object') return false;
  const record = body as Record<string, unknown>;
  return record.status === 'ok' && typeof record.time === 'string' && typeof record.mode === 'string';
}
