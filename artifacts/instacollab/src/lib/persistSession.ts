import { flushCloudAppStateSync } from './auth/cloudAppState';
import { flushCloudProfileSync } from './auth/cloudProfile';
import { db } from './db/localDb';
import { healLaunchProgressForReturningUser } from './launchRoute';
import { ensureKaraokeRecordingsHydrated } from './karaokeRecordings';
import { ensureKaraokeUploadsHydrated } from './karaokeUploads';
import { scheduleLiveSessionSync } from './liveSessionSync';

let guardsInstalled = false;

/** Flush cloud + reconcile wallet after IDB restore on cold start / refresh. */
export function installPersistenceGuards(): void {
  if (guardsInstalled || typeof window === 'undefined') return;
  guardsInstalled = true;

  let flushing = false;
  const flushPendingCloud = () => {
    if (flushing) return;
    flushing = true;
    void Promise.all([flushCloudAppStateSync(), flushCloudProfileSync()]).finally(() => {
      flushing = false;
    });
  };

  window.addEventListener('pagehide', flushPendingCloud);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingCloud();
  });

  if (navigator.storage?.persist) {
    void navigator.storage.persist().catch(() => undefined);
  }

  void db.whenStorageReady().then(() => {
    healLaunchProgressForReturningUser(db);
    ensureKaraokeUploadsHydrated();
    ensureKaraokeRecordingsHydrated();
    if (db.isLoggedIn && db.currentUserId) {
      scheduleLiveSessionSync(db.currentUserId);
    }
  });
}
