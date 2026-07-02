/**
 * Silent PWA / service-worker updates — new builds apply when the app backgrounds,
 * without reinstalling or flashing a reload mid-interaction.
 */
import { recoverStaleBuild, shouldRegisterPwa } from './pwaRegister';

const UPDATE_POLL_MS = 3 * 60_000;
let installed = false;
let pendingRefresh: (() => Promise<void>) | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

export function registerPwaRefreshHandler(handler: () => Promise<void>): void {
  pendingRefresh = handler;
}

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

export async function applySilentAppUpdate(reason = 'update'): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (pendingRefresh) {
    try {
      await pendingRefresh();
      return true;
    } catch {
      /* fall through */
    }
  }

  if (/chunk|stale|deploy/i.test(reason)) {
    await recoverStaleBuild();
    return true;
  }

  return false;
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
