/** Normalize loopback hosts so OAuth redirect matches Supabase allowlist entries. */
function normalizeLoopbackOrigin(origin: string): string {
  return origin
    .replace(/^http:\/\/127\.0\.0\.1(?=:\d+|\/|$)/, 'http://localhost')
    .replace(/^https:\/\/127\.0\.0\.1(?=:\d+|\/|$)/, 'https://localhost');
}

/** Default dev origin (override with VITE_APP_ORIGIN in .env). */
export function getConfiguredAppOrigin(): string {
  const fromEnv = String(import.meta.env.VITE_APP_ORIGIN || '').trim().replace(/\/$/, '');
  if (fromEnv) return normalizeLoopbackOrigin(fromEnv);
  return 'http://localhost:5173';
}

/**
 * OAuth return URL — must be listed in Supabase → Authentication → URL Configuration.
 * Uses VITE_APP_ORIGIN when set; otherwise current page origin (127.0.0.1 → localhost).
 */
export function getAuthRedirectUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const fromEnv = String(import.meta.env.VITE_APP_ORIGIN || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  const { origin, pathname, search } = window.location;
  const path = pathname && pathname !== '/' ? pathname : '';
  return `${normalizeLoopbackOrigin(origin)}${path}${search}`;
}

/** Origins to register in Supabase + Google Cloud for the current dev setup. */
export function getSuggestedOAuthOrigins(): string[] {
  const origins = new Set<string>([getConfiguredAppOrigin()]);

  if (typeof window !== 'undefined') {
    origins.add(normalizeLoopbackOrigin(window.location.origin));
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      origins.add('http://localhost:5173');
      origins.add('http://127.0.0.1:5173');
    }
  }

  return [...origins].filter(Boolean);
}
