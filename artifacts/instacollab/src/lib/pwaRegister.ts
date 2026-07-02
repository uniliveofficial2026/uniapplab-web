import { registerSW } from 'virtual:pwa-register';

let updateSw: ((reloadPage?: boolean) => Promise<void>) | null = null;
let pendingPwaRefresh: (() => Promise<void>) | null = null;

export function isPrivateDevHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^10\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  return false;
}

export function isPwaInstallableHost(hostname = typeof window !== 'undefined' ? window.location.hostname : ''): boolean {
  if (!hostname) return false;
  if (isPrivateDevHost(hostname)) return false;
  return true;
}

export function shouldRegisterPwa(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.DEV && import.meta.env.VITE_PWA_DEV !== 'true') return false;
  if (isPrivateDevHost(window.location.hostname)) return false;
  return true;
}

export function registerAppServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (!shouldRegisterPwa()) return;

  updateSw = registerSW({
    immediate: true,
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent('pwa-offline-ready'));
    },
    onNeedRefresh() {
      pendingPwaRefresh = () => updateSw?.(true) ?? Promise.resolve();
    },
    onRegistered() {
      // No background update polling — avoids mid-session takeover / reload.
    },
  });
}

export function applyPwaUpdate() {
  void updateSw?.(true);
}

/** Recover when lazy chunks 404 after a deploy (stale SW or cached index.html). */
export async function recoverStaleBuild(): Promise<void> {
  if (typeof window === 'undefined') return;

  if (pendingPwaRefresh) {
    await pendingPwaRefresh();
    return;
  }

  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
  }

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  const url = new URL(window.location.href);
  url.searchParams.set('_chunk_recovery', String(Date.now()));
  window.location.replace(url.toString());
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isIosChrome(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /CriOS/i.test(navigator.userAgent);
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return isIosDevice() && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

export function getIosInstallInstructions(): { steps: string; note?: string } {
  if (isIosChrome()) {
    return {
      steps: 'Tap Share in the address bar, then Add to Home Screen.',
      note: 'On iPhone/iPad, home screen apps open in their own window (Apple WebKit), not inside Chrome.',
    };
  }
  return {
    steps: 'Tap Share, then Add to Home Screen.',
    note: 'Use Safari for the most reliable install on iPhone and iPad.',
  };
}
