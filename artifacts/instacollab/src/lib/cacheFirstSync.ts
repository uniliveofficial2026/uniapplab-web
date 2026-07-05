/**
 * Cache-first data pipeline:
 * 1) IndexedDB / localStorage drive the UI at all times
 * 2) When online, live cloud syncs in the background — no loaders, no remounts
 * 3) When offline, app keeps working from cache; reconnect resumes silent sync
 */
import { db } from './db/localDb';
import {
  initNetworkStatus,
  isNetworkOnline,
  subscribeNetworkStatus,
} from './networkStatus';
import { isCloudAuthUserId } from './auth/cloudProfile';
import { runInstant } from './instantTask';
import { cloudKickCooldownMs } from './liveCloudSyncMode';

let installed = false;
let syncGeneration = 0;
let lastKickAt = 0;

function canSync(): boolean {
  if (!isNetworkOnline()) return false;
  const userId = db.currentUserId;
  return Boolean(userId && db.isLoggedIn && isCloudAuthUserId(userId));
}

async function paintThen<T>(fn: () => Promise<T>): Promise<T> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  return fn();
}

/** Silent background live sync — never throws to UI. */
export async function runSilentCloudSync(reason: string): Promise<void> {
  if (!canSync()) return;
  const generation = ++syncGeneration;
  const userId = db.currentUserId!;

  try {
    await db.whenStorageReady();
    if (generation !== syncGeneration || !canSync()) return;

    const { startLiveCloudSurfaces } = await import('./liveCloudSurfaces');
    if (generation !== syncGeneration) return;
    startLiveCloudSurfaces(userId);

    const { bootstrapCloudPosts } = await import('./cloudPostSync');
    if (generation !== syncGeneration) return;
    void bootstrapCloudPosts();

    if (import.meta.env.DEV) {
      console.info('[cache-first] silent cloud sync', reason, userId.slice(0, 8));
    }
  } catch (err) {
    // Silent — local cache remains the UI source of truth.
    if (import.meta.env.DEV) {
      console.warn('[cache-first] silent sync failed:', err);
    }
  }
}

/** Call once after React has mounted — never blocks UI. */
export function startCacheFirstCloudSync(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  initNetworkStatus();

  const kick = (reason: string) => {
    const isUrgent = reason === 'storage_ready';
    const now = Date.now();
    if (!isUrgent && now - lastKickAt < cloudKickCooldownMs()) return;
    lastKickAt = now;
    runInstant(() => {
      void paintThen(() => runSilentCloudSync(reason));
    });
  };

  void db.whenStorageReady().then(() => kick('storage_ready'));

  // Reconnect after offline: one full live sync.
  subscribeNetworkStatus((status) => {
    if (status === 'online') kick('online');
  });
}
