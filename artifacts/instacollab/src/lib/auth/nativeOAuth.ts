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
 */
export async function handleNativeOAuthDeepLink(url: string): Promise<boolean> {
  if (!isNativeShell() || !isNativeOAuthCallbackUrl(url)) return false;
  await closeNativeOAuthBrowser();
  const search = nativeOAuthCallbackToAppSearch(url);
  if (!search) return false;
  const next = `${window.location.pathname || '/'}${search}`;
  window.location.replace(next);
  return true;
}
