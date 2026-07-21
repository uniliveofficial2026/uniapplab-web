import { appBasePath } from '../appShellRoutes';

/** Production embed path when served on the Greedy Tap origin. */
const GREEDY_TAP_GAME_SUBPATH = '/games/greedy-slot/';

function normalizeTrailingSlash(url: string): string {
  return url.replace(/\/?$/, '/');
}

function joinAppPath(subpath: string): string {
  const base = appBasePath();
  return normalizeTrailingSlash(`${base}${subpath}`.replace(/\/{2,}/g, '/'));
}

function greedyTapOrigin(): string {
  const fromEnv = (import.meta.env.VITE_GREEDY_TAP_ORIGIN as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:3000';
  }

  if (typeof window !== 'undefined') {
    return window.location.origin.replace(/\/$/, '');
  }

  return (import.meta.env.VITE_APP_ORIGIN || 'https://app.uniapplab.com').replace(/\/$/, '');
}

/** Resolve where the Greedy Tap iframe loads. */
export function resolveGreedyTapAppUrl(): string {
  const override = (import.meta.env.VITE_GREEDY_TAP_APP_URL as string | undefined)?.trim();
  if (override) return normalizeTrailingSlash(override);

  const origin = greedyTapOrigin();
  if (import.meta.env.DEV) {
    return normalizeTrailingSlash(`${origin}/`);
  }

  return normalizeTrailingSlash(`${origin}${joinAppPath(GREEDY_TAP_GAME_SUBPATH)}`);
}

export const GREEDY_TAP_APP_URL = resolveGreedyTapAppUrl();

/** Same-origin in the browser so Vite/production proxy can reach the bundled server (avoids CORS). */
export function greedyTapHealthUrl(): string {
  const override = (import.meta.env.VITE_GREEDY_TAP_APP_URL as string | undefined)?.trim();
  if (override) {
    return new URL('/api/health', override).toString();
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}${joinAppPath('/api/health')}`.replace(/([^:]\/)\/+/g, '$1');
  }

  const origin = greedyTapOrigin();
  return `${origin}/api/health`;
}
