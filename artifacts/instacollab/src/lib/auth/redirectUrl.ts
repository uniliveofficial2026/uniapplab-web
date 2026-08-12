import {
  getAppOrigin,
  getOAuthAllowlistOrigins,
  isLocalDevHost,
  uniapplabOrigin,
} from '../domains/uniapplab';
import { isNativeShell } from '../nativeShell';
import { getNativeOAuthRedirectUrl } from './nativeOAuth';

/** Normalize loopback hosts so OAuth redirect matches Supabase allowlist entries. */
function normalizeLoopbackOrigin(origin: string): string {
  return origin
    .replace(/^http:\/\/127\.0\.0\.1(?=:\d+|\/|$)/, 'http://localhost')
    .replace(/^https:\/\/127\.0\.0\.1(?=:\d+|\/|$)/, 'https://localhost');
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  } catch {
    return /localhost|127\.0\.0\.1/i.test(origin);
  }
}

/** Production app origin — never localhost (avoids "localhost refused to connect" after Google OAuth). */
export function getProductionAppOrigin(): string {
  return uniapplabOrigin('app');
}

/**
 * Resolve a safe public app origin for OAuth redirects.
 * - Dev on a real loopback host: keep that origin so local OAuth works.
 * - Production / native / PWA: never redirect to localhost (common Capacitor + bad env bake).
 */
export function resolvePublicAppOrigin(): string {
  const production = getProductionAppOrigin();
  const fromEnv = String(import.meta.env.VITE_APP_ORIGIN || '').trim().replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    if (isNativeShell()) {
      // Capacitor WebView must return to the real product URL, not https://localhost.
      return production;
    }
    if (import.meta.env.DEV && isLocalDevHost(hostname)) {
      return normalizeLoopbackOrigin(origin);
    }
    if (!import.meta.env.DEV && isLocalDevHost(hostname)) {
      // Prod bundle opened on loopback (misconfigured native hostname) → force product URL.
      return production;
    }
  }

  if (fromEnv && !isLoopbackOrigin(fromEnv)) return fromEnv;
  if (fromEnv && isLoopbackOrigin(fromEnv) && import.meta.env.DEV) return fromEnv;

  const configured = normalizeLoopbackOrigin(getAppOrigin());
  if (configured && !isLoopbackOrigin(configured)) return configured;
  if (configured && isLoopbackOrigin(configured) && import.meta.env.DEV) return configured;

  return production;
}

/** Default app origin (override with VITE_APP_ORIGIN in .env). */
export function getConfiguredAppOrigin(): string {
  return resolvePublicAppOrigin();
}

/**
 * OAuth return URL — must be listed in Supabase → Authentication → URL Configuration
 * (and matching Google/Apple redirect URIs for every host users open):
 * - https://app.uniapplab.com
 * - com.uniapplab.unilive://auth/callback (iOS/Android Capacitor)
 * - https://*.vercel.app preview origins used in QA
 * - http://localhost:<port> for local Vite only
 *
 * Production web: https://app.uniapplab.com (never localhost).
 * Native: custom scheme deep link (system browser → app), never localhost.
 */
export function getAuthRedirectUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  // Capacitor: return via app deep link so Google never lands on localhost.
  if (isNativeShell()) {
    return getNativeOAuthRedirectUrl();
  }

  const publicOrigin = resolvePublicAppOrigin();
  const { pathname, search, hostname } = window.location;

  // Local Vite only: preserve path so deep-link returns work.
  if (import.meta.env.DEV && isLocalDevHost(hostname)) {
    const path = pathname && pathname !== '/' ? pathname : '';
    return `${publicOrigin}${path}${search}`;
  }

  // Preview deploys: stay on the vercel.app host.
  if (hostname.endsWith('vercel.app')) {
    const path = pathname && pathname !== '/' ? pathname : '';
    return `${normalizeLoopbackOrigin(window.location.origin)}${path}${search}`;
  }

  // Production OAuth must return to the app origin root (SPA), never a deep path that 404s.
  return publicOrigin;
}

/** Origins to register in Supabase + Google Cloud. */
export function getSuggestedOAuthOrigins(): string[] {
  return getOAuthAllowlistOrigins();
}

export {
  getAppOrigin,
  getOAuthAllowlistOrigins,
  uniapplabOrigin,
  uniapplabHost,
  isUniapplabHost,
  UNIAPPLAB_APEX,
  UNIAPPLAB_SERVICES,
} from '../domains/uniapplab';
