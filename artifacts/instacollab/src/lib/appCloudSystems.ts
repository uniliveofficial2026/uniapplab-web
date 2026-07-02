/**
 * One bootstrap for all live cloud + PWA systems — auto-starts on boot,
 * reconnect, and foreground without reinstalling the app.
 */
import { flushCloudAppStateSync } from './auth/cloudAppState';
import { initCloudAppStateNetworkResume } from './auth/cloudAppState';
import { flushCloudProfileSync } from './auth/cloudProfile';
import { isCloudAuthConfigured } from './auth/config';
import { db } from './db/localDb';
import { initLiveAutoReload } from './liveAutoReload';
import { scheduleLiveSessionSync } from './liveSessionSync';
import { initLiveSessionSync } from './liveSessionSync';
import { initNetworkStatus, isNetworkOnline, subscribeNetworkStatus } from './networkStatus';
import { checkForPwaUpdate, initPwaAutoUpdate } from './pwaAutoUpdate';
import {
  initThoughtNoteCloudSync,
  refreshThoughtNotesFromCloud,
} from './thoughtNoteCloudSync';
import {
  initThoughtNoteLiveSync,
} from './thoughtNoteLiveSync';

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
    await checkForPwaUpdate();

    if (!isNetworkOnline()) return;

    await db.whenStorageReady();

    initThoughtNoteCloudSync();

    const userId = db.currentUserId;
    if (!userId || !db.isLoggedIn) return;

    if (isCloudAuthConfigured()) {
      scheduleLiveSessionSync(userId);
      await refreshThoughtNotesFromCloud().catch(() => undefined);
      await Promise.all([
        flushCloudAppStateSync().catch(() => undefined),
        flushCloudProfileSync().catch(() => undefined),
      ]);
    }

    if (import.meta.env.DEV) {
      console.info('[cloud-systems] tick', reason, userId.slice(0, 8));
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
    void tickCloudSystems('storage_ready');
  });

  subscribeNetworkStatus((status) => {
    if (status === 'online') void tickCloudSystems('online');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void tickCloudSystems('foreground');
    }
  });

  window.addEventListener('focus', () => {
    void tickCloudSystems('focus');
  });
}

/** Call after cloud auth session is applied (login / restore / account switch). */
export function bootstrapCloudSystemsAfterAuth(): void {
  void tickCloudSystems('auth_ready');
}
