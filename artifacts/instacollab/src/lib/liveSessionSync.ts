/**
 * Live session sync — one pipeline for local demo (`u1`), offline demo auth, and uniapplab.com cloud.
 *
 * Local / demo: reconcile wallet ↔ K-Star, hydrate karaoke metadata, per-account IDB snapshots.
 * Cloud (UUID): above + profile/me from API, server wallet pull, user_app_state realtime (cloudAppState).
 */
import { db } from './db/localDb';
import { isCloudAuthUserId } from './auth/cloudProfile';
import { ensureKaraokeRecordingsHydrated } from './karaokeRecordings';
import { ensureKaraokeUploadsHydrated } from './karaokeUploads';
import { ensureKstarUserStateMigrated } from './kstarUserState';
import { onUserSessionActive } from './walletKstarSync';
import { hydratePlatformSession, syncServerWalletBalance } from './walletServerSync';

let listenersInstalled = false;
let syncChain: Promise<void> = Promise.resolve();

export async function syncLiveSessionData(userId: string): Promise<void> {
  const id = userId?.trim();
  if (!id || db.currentUserId !== id) return;

  syncChain = syncChain.then(async () => {
    if (db.currentUserId !== id) return;

    ensureKstarUserStateMigrated(id);
    ensureKaraokeUploadsHydrated();
    ensureKaraokeRecordingsHydrated();

    if (isCloudAuthUserId(id)) {
      await hydratePlatformSession(id);
      await syncServerWalletBalance(id);
    }

    onUserSessionActive(id);
    window.dispatchEvent(new CustomEvent('live-session-synced', { detail: { userId: id } }));
  });

  await syncChain;
}

export function scheduleLiveSessionSync(userId: string): void {
  const id = userId?.trim();
  if (!id) return;
  queueMicrotask(() => void syncLiveSessionData(id));
}

/** Refresh server wallet when tab becomes visible (cloud accounts only). */
export function initLiveSessionSync(): void {
  if (listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const uid = db.currentUserId?.trim();
    if (!uid || !isCloudAuthUserId(uid)) return;
    void syncServerWalletBalance(uid).then(() => onUserSessionActive(uid));
  });
}
