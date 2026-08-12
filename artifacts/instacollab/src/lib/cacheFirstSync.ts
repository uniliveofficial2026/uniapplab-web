/**
 * Cache-first data pipeline:
 * 1) IndexedDB / localStorage drive the UI at all times
 * 2) Supabase Realtime + Firebase listeners keep every surface live in the background
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

/** Start all Realtime lanes + initial hydrate — never throws to UI. */
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

    const [{ bootstrapCloudPosts }, { startCloudAppStateRealtime }] = await Promise.all([
      import('./cloudPostSync'),
      import('./auth/cloudAppState'),
    ]);
    if (generation !== syncGeneration) return;

    void startCloudAppStateRealtime(userId);
    void bootstrapCloudPosts();

    if (import.meta.env.DEV) {
      console.info('[cache-first] realtime lanes live', reason, userId.slice(0, 8));
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[cache-first] realtime start failed:', err);
    }
  }
}

/** Call once after React has mounted — never blocks UI. */
export function startCacheFirstCloudSync(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  initNetworkStatus();

  const kick = (reason: string) => {
    const isUrgent =
      reason === 'storage_ready' || reason === 'online' || reason === 'auth_ready';
    const now = Date.now();
    const cooldown = cloudKickCooldownMs();
    if (!isUrgent && cooldown > 0 && now - lastKickAt < cooldown) return;
    lastKickAt = now;
    // Microtask only — no rAF delay before realtime lanes arm.
    runInstant(() => {
      void runSilentCloudSync(reason);
    });
  };

  void db.whenStorageReady().then(() => kick('storage_ready'));

  // Inbound updates flow through Supabase Realtime — no pull-on-local-save loop.

  subscribeNetworkStatus((status) => {
    if (status === 'online') kick('online');
  });
}

/** Re-arm all Realtime channels after auth session is restored. */
export function kickRealtimeAfterAuth(): void {
  if (!canSync()) return;
  runInstant(() => {
    void runSilentCloudSync('auth_ready');
  });
}
