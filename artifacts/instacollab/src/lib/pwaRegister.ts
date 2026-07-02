import { registerSW } from 'virtual:pwa-register';
import { APP_UPDATE_STAGED_EVENT, stageAppUpdate } from './invisibleReload';
import { checkForPwaUpdate } from './pwaAutoUpdate';

let updateSw: ((reloadPage?: boolean) => Promise<void>) | null = null;

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
      void (async () => {
        try {
          await updateSw?.(false);
        } catch {
          await checkForPwaUpdate();
        }
        stageAppUpdate('pwa_update');
        window.dispatchEvent(
          new CustomEvent(APP_UPDATE_STAGED_EVENT, { detail: { reason: 'pwa_update' } }),
        );
      })();
    },
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        window.setInterval(() => {
          void registration.update();
        }, 60 * 60_000);
      }
    },
  });
}

/** Optional manual refresh — only when the user explicitly asks to reload. */
export function applyPwaUpdate() {
  void updateSw?.(true);
}

/** Stage a new build after lazy-chunk failure — never forces a full page reload. */
export async function recoverStaleBuild(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await updateSw?.(false);
  } catch {
    /* fall through */
  }
  await checkForPwaUpdate();
  stageAppUpdate('chunk_recovery');
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
