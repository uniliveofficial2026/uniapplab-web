/**
 * Capacitor Google/Apple OAuth — system browser + deep-link return.
 * Avoids WebView redirects to localhost (which fail with "refused to connect").
 */
import { isNativeShell } from '../nativeShell';

/** Must match AndroidManifest / Info.plist / capacitor appId. */
export const NATIVE_OAUTH_SCHEME = 'com.uniapplab.unilive';
export const NATIVE_OAUTH_CALLBACK_PATH = 'auth/callback';

/** Supabase redirectTo for native shells — never http://localhost. */
export function getNativeOAuthRedirectUrl(): string {
  return `${NATIVE_OAUTH_SCHEME}://${NATIVE_OAUTH_CALLBACK_PATH}`;
}

export function isNativeOAuthCallbackUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === `${NATIVE_OAUTH_SCHEME}:`) return true;
    if (parsed.hostname === NATIVE_OAUTH_SCHEME) return true;
    // Remote Cap: iOS may deliver the full https handoff URL with tokens.
    if (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      /uniapplab\.com$/i.test(parsed.hostname) &&
      (/\b(?:access_token|refresh_token)=/.test(parsed.hash) ||
        parsed.searchParams.has('code') ||
        parsed.searchParams.has('rt') ||
        parsed.searchParams.has('refresh_token'))
    ) {
      return true;
    }
  } catch {
    /* fall through */
  }
  return (
    url.startsWith(`${NATIVE_OAUTH_SCHEME}://`) ||
    url.includes(`${NATIVE_OAUTH_SCHEME}://`)
  );
}

/** Normalize deep-link / https callback into query+hash the SPA already understands. */
export function nativeOAuthCallbackToAppSearch(url: string): string {
  try {
    const normalized = url.includes('://')
      ? url.replace(/^[^:]+:\/\//, 'https://placeholder/')
      : `https://placeholder/${url}`;
    const parsed = new URL(normalized);
    const q = parsed.searchParams.toString();
    const hash = parsed.hash || '';
    if (q) return `?${q}${hash}`;
    if (hash) return hash;
  } catch {
    const q = url.includes('?') ? url.slice(url.indexOf('?')) : '';
    if (q) return q;
  }
  return '';
}

export async function openNativeOAuthUrl(url: string): Promise<void> {
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url, presentationStyle: 'fullscreen' });
}

export async function closeNativeOAuthBrowser(): Promise<void> {
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.close();
  } catch {
    /* already closed */
  }
}

/**
 * Apply an OAuth deep-link return inside the Capacitor WebView and let
 * existing completeSupabaseOAuthReturn() exchange the code.
 *
 * Hash session handoff prefers refresh_token-only (short) because iOS
 * payload-url length truncates dual JWT hashes and causes Script error.
 *
 * @returns 'inline' when session was set without reload; 'navigate' when
 *   location.replace was used; false when the URL was not handled.
 */
export async function handleNativeOAuthDeepLink(
  url: string,
): Promise<'inline' | 'navigate' | false> {
  if (!isNativeShell() || !isNativeOAuthCallbackUrl(url)) return false;
  // Session handoff (rt=/refresh_token=) never opened Browser — closing throws noisy Cap errors.
  const isTokenHandoff = /(?:[?#&](?:rt|refresh_token|access_token)=)/i.test(url);
  if (!isTokenHandoff) {
    await closeNativeOAuthBrowser();
  }
  const search = nativeOAuthCallbackToAppSearch(url);
  if (!search) return false;

  try {
    const hashPart = search.includes('#') ? search.slice(search.indexOf('#') + 1) : '';
    const queryPart = search.startsWith('?')
      ? search.slice(1, search.includes('#') ? search.indexOf('#') : undefined)
      : '';
    const hashParams = new URLSearchParams(hashPart.replace(/^#/, ''));
    const queryParams = new URLSearchParams(queryPart);
    const hashAccess = hashParams.get('access_token') || queryParams.get('access_token');
    const hashRefresh =
      hashParams.get('refresh_token') ||
      queryParams.get('refresh_token') ||
      queryParams.get('rt');

    if (hashRefresh || hashAccess) {
      const { getSupabaseClientAsync } = await import('../supabase/client');
      const { withTimeout } = await import('../networkPolicy');
      const { writeStoredAuthBackend } = await import('./providerState');
      const { persistGoogleProviderTokenFromSession } = await import('./completeSupabaseOAuthReturn');
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return false;

      let session = null as Awaited<
        ReturnType<typeof supabase.auth.setSession>
      >['data']['session'];

      // Prefer refresh-only — avoids truncated dual-JWT deep links on iOS.
      if (hashRefresh && (!hashAccess || hashAccess.length < 40)) {
        const { data, error } = await withTimeout(
          supabase.auth.refreshSession({ refresh_token: hashRefresh }),
          8_000,
          'Supabase refreshSession(native)',
        );
        if (error) {
          console.warn('[auth] native refreshSession failed', error.message);
        } else {
          session = data.session;
        }
      }

      if (!session && hashAccess && hashRefresh) {
        const { data, error } = await withTimeout(
          supabase.auth.setSession({
            access_token: hashAccess,
            refresh_token: hashRefresh,
          }),
          8_000,
          'Supabase setSession(native-hash)',
        );
        if (error) {
          console.warn('[auth] native setSession failed', error.message);
        } else {
          session = data.session;
        }
      }

      if (!session?.user) return false;
      writeStoredAuthBackend('supabase');
      persistGoogleProviderTokenFromSession(session);
      void import('./syncSession')
        .then(({ syncCloudSessionNow }) => syncCloudSessionNow())
        .catch(() => undefined);
      void import('../platformApi')
        .then(({ postPresenceHeartbeat }) => postPresenceHeartbeat())
        .catch(() => undefined);
      try {
        const path = window.location.pathname || '/home';
        window.history.replaceState({}, document.title, path);
      } catch {
        /* ignore */
      }
      return 'inline';
    }
  } catch (err) {
    console.warn(
      '[auth] native deep-link apply failed',
      err instanceof Error ? err.message : err,
    );
    /* fall through to navigation-based exchange */
  }

  // Code / OTP returns: put short params into SPA URL (never huge dual JWTs).
  if (/access_token=/i.test(search) && search.length > 1800) {
    console.warn('[auth] refusing oversized token URL navigation on Cap');
    return false;
  }

  // Prefer explicit /home for Cap remote-server builds (avoid `/` + hash no-reload).
  const path =
    window.location.protocol === 'https:' && /uniapplab\.com$/i.test(window.location.hostname)
      ? '/home'
      : '/home';
  const next = `${path}${search}`;
  window.location.replace(next);
  window.setTimeout(() => {
    void import('./completeSupabaseOAuthReturn').then(({ completeSupabaseOAuthReturn }) => {
      void completeSupabaseOAuthReturn();
    });
  }, 50);
  return 'navigate';
}
