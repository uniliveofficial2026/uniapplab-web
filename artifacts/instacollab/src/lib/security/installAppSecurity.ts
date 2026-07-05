/**
 * Client-side hardening — silent, no UI. Complements CSP headers on Vercel.
 */
import { isUniapplabHost } from '../domains/uniapplab';

const ALLOWED_API_HOSTS = new Set([
  'app.uniapplab.com',
  'uniapplab.com',
  'www.uniapplab.com',
  'localhost',
  '127.0.0.1',
]);

function isAllowedApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin === window.location.origin) return true;
    if (import.meta.env.DEV && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return true;
    }
    return isUniapplabHost(parsed.hostname) || ALLOWED_API_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function guardFetch(): void {
  if (typeof window === 'undefined' || import.meta.env.DEV) return;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/') && !isAllowedApiUrl(url)) {
      console.warn('[security] blocked cross-origin API request');
      return Promise.reject(new Error('Blocked'));
    }
    return nativeFetch(input, init);
  };
}

function guardWindowOpen(): void {
  if (typeof window === 'undefined') return;
  const nativeOpen = window.open.bind(window);
  window.open = (url?: string | URL, target?: string, features?: string) => {
    if (url) {
      const href = String(url);
      if (/^javascript:/i.test(href) || /^data:text\/html/i.test(href)) {
        console.warn('[security] blocked dangerous window.open');
        return null;
      }
    }
    return nativeOpen(url, target, features);
  };
}

/** Install passive client guards once at boot. */
export function installAppSecurity(): void {
  if (typeof window === 'undefined') return;
  guardFetch();
  guardWindowOpen();
}
