import {
  getAppOrigin,
  getOAuthAllowlistOrigins,
  isLocalDevHost,
  isUniapplabHost,
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
 * Uses the current browser origin on uniapplab.com / app.uniapplab.com (not only VITE_APP_ORIGIN).
 */
export function getAuthRedirectUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const { origin, pathname, search, hostname } = window.location;
  const path = pathname && pathname !== '/' ? pathname : '';
  const withPath = `${origin.replace(/\/$/, '')}${path}${search}`;

  if (isLocalDevHost(hostname) || hostname.endsWith('vercel.app')) {
    return `${normalizeLoopbackOrigin(origin)}${path}${search}`;
  }

  if (isUniapplabHost(hostname)) {
    return withPath;
  }

  const fromEnv = String(import.meta.env.VITE_APP_ORIGIN || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  return getConfiguredAppOrigin();
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
