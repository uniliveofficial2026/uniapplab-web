/**
 * One bootstrap for all live cloud + PWA systems — auto-starts on boot,
 * reconnect, and foreground without reinstalling the app.
 *
 * Offline: no-op (local cache keeps UI alive).
 * Online: silent background sync only — never blocks or flashes UI.
 */
import { flushCloudAppStateSync } from './auth/cloudAppState';
import { initCloudAppStateNetworkResume } from './auth/cloudAppState';
import { flushCloudProfileSync } from './auth/cloudProfile';
import { isCloudAuthConfigured } from './auth/config';
import { isCloudAuthUserId } from './auth/cloudProfile';
import { db } from './db/localDb';
import { initLiveAutoReload } from './liveAutoReload';
import { scheduleLiveSessionSync } from './liveSessionSync';
import { initLiveSessionSync } from './liveSessionSync';
import { startLiveCloudSurfaces } from './liveCloudSurfaces';
import { initNetworkStatus, isNetworkOnline, subscribeNetworkStatus } from './networkStatus';
import { checkForPwaUpdate, initPwaAutoUpdate } from './pwaAutoUpdate';
import {
  initThoughtNoteCloudSync,
  refreshThoughtNotesFromCloud,
} from './thoughtNoteCloudSync';
import {
  initThoughtNoteLiveSync,
} from './thoughtNoteLiveSync';
import { runSilentCloudSync } from './cacheFirstSync';

let installed = false;
let tickInFlight = false;
let tickAgain = false;

async function tickCloudSystems(reason: string): Promise<void> {
  if (tickInFlight) {
    tickAgain = true;
    return;
  }
  tickInFlight = true;
  try {
    // Offline: stay on local cache only — do not touch UI.
    if (!isNetworkOnline()) return;

    await db.whenStorageReady();

    const userId = db.currentUserId;
    if (!userId || !db.isLoggedIn) return;

    // PWA / heal in background — never awaited for UI.
    void checkForPwaUpdate().catch(() => undefined);
    void import('./runtimeAutoHeal').then((m) => m.reactImmediately(`cloud:${reason}`));

    initThoughtNoteCloudSync();

    if (isCloudAuthConfigured()) {
      // Silent live surfaces + feed (cache-first merge, no loaders).
      void runSilentCloudSync(reason);

      if (isCloudAuthUserId(userId)) {
        startLiveCloudSurfaces(userId);
      }
      scheduleLiveSessionSync(userId);
      // Fire-and-forget flushes — do not block the tick on network.
      void refreshThoughtNotesFromCloud().catch(() => undefined);
      void flushCloudAppStateSync().catch(() => undefined);
      void flushCloudProfileSync().catch(() => undefined);
    }

    if (import.meta.env.DEV) {
      console.info('[cloud-systems] silent tick', reason, userId.slice(0, 8));
    }
  } finally {
    tickInFlight = false;
    if (tickAgain) {
      tickAgain = false;
      queueMicrotask(() => void tickCloudSystems('coalesced'));
    }
  }
}

export function initAppCloudSystems(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  initNetworkStatus();
  initThoughtNoteLiveSync();
  initCloudAppStateNetworkResume();
  initPwaAutoUpdate();
  initLiveAutoReload();
  initLiveSessionSync();

  void db.whenStorageReady().then(() => {
    initThoughtNoteCloudSync();
    // Only sync if online; offline stays on cache.
    if (isNetworkOnline()) void tickCloudSystems('storage_ready');
  });

  subscribeNetworkStatus((status) => {
    if (status === 'online') {
      // Instant silent resume — no loaders, no route changes.
      void tickCloudSystems('online');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isNetworkOnline()) {
      void tickCloudSystems('foreground');
    }
  });

  window.addEventListener('focus', () => {
    if (isNetworkOnline()) void tickCloudSystems('focus');
  });
}

/** Call after cloud auth session is applied (login / restore / account switch). */
export function bootstrapCloudSystemsAfterAuth(): void {
  if (!isNetworkOnline()) return;
  void tickCloudSystems('auth_ready');
  void import('./preloadAppSurfaces').then((m) => m.preloadAllAppSurfaces());
}

/** Refresh live cloud data in-place (no page reload). */
export function refreshCloudSystemsInPlace(reason = 'refresh'): void {
  if (!isNetworkOnline()) return;
  void tickCloudSystems(reason);
}
