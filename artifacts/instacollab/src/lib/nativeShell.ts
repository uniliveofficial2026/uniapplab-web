/**
 * Detect Capacitor / native WebView shells so PWA SW and browser-only paths
 * stay out of the native container (same web app, seamless API data flow).
 */

export function isNativeShell(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  const proto = window.location.protocol;
  return proto === 'capacitor:' || proto === 'ionic:';
}

export function nativePlatform(): 'ios' | 'android' | 'web' {
  if (!isNativeShell()) return 'web';
  const cap = (window as Window & {
    Capacitor?: { getPlatform?: () => string };
  }).Capacitor;
  const p = String(cap?.getPlatform?.() ?? '').toLowerCase();
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  return 'web';
}
