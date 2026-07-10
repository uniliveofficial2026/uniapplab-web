import {
  getAppOrigin,
  getOAuthAllowlistOrigins,
  isLocalDevHost,
} from '../domains/uniapplab';

/** Normalize loopback hosts so OAuth redirect matches Supabase allowlist entries. */
function normalizeLoopbackOrigin(origin: string): string {
  return origin
    .replace(/^http:\/\/127\.0\.0\.1(?=:\d+|\/|$)/, 'http://localhost')
    .replace(/^https:\/\/127\.0\.0\.1(?=:\d+|\/|$)/, 'https://localhost');
}

/** Default dev origin (override with VITE_APP_ORIGIN in .env). */
export function getConfiguredAppOrigin(): string {
  return normalizeLoopbackOrigin(getAppOrigin());
}

/**
 * OAuth return URL — must be listed in Supabase → Authentication → URL Configuration.
 * Production: https://app.uniapplab.com
 */
export function getAuthRedirectUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const fromEnv = String(import.meta.env.VITE_APP_ORIGIN || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  const configured = getConfiguredAppOrigin();
  const { origin, pathname, search, hostname } = window.location;
  if (isLocalDevHost(hostname) || hostname.endsWith('vercel.app')) {
    const path = pathname && pathname !== '/' ? pathname : '';
    return `${normalizeLoopbackOrigin(origin)}${path}${search}`;
  }

  // Production OAuth must return to the app origin root (SPA), never a deep path that 404s.
  return configured || normalizeLoopbackOrigin(origin);
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
