/**
 * One bootstrap for all live cloud + PWA systems — auto-starts on boot,
 * reconnect, and foreground without reinstalling the app.
 *
 * Offline: no-op (local cache keeps UI alive).
 * Online: silent background sync only — never blocks or flashes UI.
 */
import { flushCloudAppStateSync } from './auth/cloudAppState';
import { initCloudAppStateNetworkResume } from './auth/cloudAppState';
import { isCloudAuthConfigured } from './auth/config';
import { isCloudAuthUserId } from './auth/cloudProfile';
import { db } from './db/localDb';
import { initLiveAutoReload } from './liveAutoReload';
import { scheduleLiveSessionSync } from './liveSessionSync';
import { initLiveSessionSync } from './liveSessionSync';
import { startLiveCloudSurfaces, refreshLiveCloudSurface } from './liveCloudSurfaces';
import { initNetworkStatus, isNetworkOnline, subscribeNetworkStatus } from './networkStatus';
import { checkForPwaUpdate, initPwaAutoUpdate } from './pwaAutoUpdate';
import { initThoughtNoteCloudSync } from './thoughtNoteCloudSync';
import {
  initThoughtNoteLiveSync,
} from './thoughtNoteLiveSync';
import { runSilentCloudSync } from './cacheFirstSync';
import { cloudTickCooldownMs } from './liveCloudSyncMode';

let installed = false;
let tickInFlight = false;
let tickAgain = false;
let lastTickAt = 0;

async function tickCloudSystems(reason: string, force = false): Promise<void> {
  if (tickInFlight) {
    tickAgain = true;
    return;
  }

  const now = Date.now();
  const isUrgent = reason === 'auth_ready' || reason === 'storage_ready';
  if (!force && !isUrgent && now - lastTickAt < cloudTickCooldownMs()) return;

  tickInFlight = true;
  lastTickAt = now;
  try {
    // Offline: stay on local cache only — do not touch UI.
    if (!isNetworkOnline()) return;

    await db.whenStorageReady();

    const userId = db.currentUserId;
    if (!userId || !db.isLoggedIn) return;

    // PWA update check — low priority, never blocks UI.
    void checkForPwaUpdate().catch(() => undefined);

    initThoughtNoteCloudSync();

    if (isCloudAuthConfigured()) {
      if (isUrgent) {
        // Full live pipeline once per boot / login.
        void runSilentCloudSync(reason);
        if (isCloudAuthUserId(userId)) {
          startLiveCloudSurfaces(userId);
        }
      } else {
        // Foreground: refresh current cloud lane without restarting all channels.
        scheduleLiveSessionSync(userId);
        void flushCloudAppStateSync().catch(() => undefined);
        refreshLiveCloudSurface('all');
      }
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
}

/** Call after cloud auth session is applied (login / restore / account switch). */
export function bootstrapCloudSystemsAfterAuth(): void {
  if (!isNetworkOnline()) return;
  void tickCloudSystems('auth_ready');
  void import('./preloadAppSurfaces').then((m) => m.preloadCoreAppSurfaces());
}

/** Refresh live cloud data in-place (no page reload). */
export function refreshCloudSystemsInPlace(reason = 'refresh'): void {
  if (!isNetworkOnline()) return;
  void tickCloudSystems(reason);
}
