/**
 * Silent PWA / service-worker updates — new builds stage in the background and
 * apply on the next cold start, without reinstalling or reloading mid-session.
 */
import { shouldRegisterPwa } from './pwaRegister';

const UPDATE_POLL_MS = 3 * 60_000;
let installed = false;
let pollTimer: number | null = null;

export async function checkForPwaUpdate(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (!shouldRegisterPwa()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.update();
  } catch {
    /* offline or transient */
  }
}

/** Stage an update in the background; never reloads the current page. */
export async function applySilentAppUpdate(_reason = 'update'): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  await checkForPwaUpdate();
  return true;
}

export function initPwaAutoUpdate(): void {
  if (installed || typeof window === 'undefined') return;
  if (!shouldRegisterPwa()) return;
  installed = true;

  void checkForPwaUpdate();

  pollTimer = window.setInterval(() => {
    void checkForPwaUpdate();
  }, UPDATE_POLL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void checkForPwaUpdate();
    }
  });
}

export function teardownPwaAutoUpdate(): void {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
  installed = false;
}
