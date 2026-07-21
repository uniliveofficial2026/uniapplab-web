import { appBasePath } from '../appShellRoutes';

/** Same-origin path for the Greedy Tap SPA shell on UniLive. */
const GREEDY_TAP_GAME_SUBPATH = '/games/greedy-slot/';

function normalizeTrailingSlash(url: string): string {
  return url.replace(/\/?$/, '/');
}

function joinAppPath(subpath: string): string {
  const base = appBasePath();
  return `${base}${subpath}`.replace(/\/{2,}/g, '/');
}

/** Optional override for the iframe URL (tests / emergency). */
export function resolveGreedyTapAppUrl(): string {
  const override = (import.meta.env.VITE_GREEDY_TAP_APP_URL as string | undefined)?.trim();
  if (override) return normalizeTrailingSlash(override);

  if (import.meta.env.DEV) {
    // Greedy Tap tab = the fixed package UI on :3000.
    return 'http://127.0.0.1:3000/';
  }

  if (typeof window !== 'undefined') {
    return normalizeTrailingSlash(`${window.location.origin}${joinAppPath(GREEDY_TAP_GAME_SUBPATH)}`);
  }

  const origin = (import.meta.env.VITE_APP_ORIGIN || 'https://app.uniapplab.com').replace(/\/$/, '');
  return normalizeTrailingSlash(`${origin}${joinAppPath(GREEDY_TAP_GAME_SUBPATH)}`);
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
