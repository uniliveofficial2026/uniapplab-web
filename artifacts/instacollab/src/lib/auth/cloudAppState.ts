import { CLOUD_SYNC_COLLECTION_KEYS, isCloudSyncCollectionKey } from '../cloudSync/collectionKeys';
import {
  CLOUD_APP_STATE_VERSION,
  type CloudAppStatePayload,
} from '../cloudSync/types';
import { db } from '../db/localDb';
import type { LocalDB } from '../db/localDbType';
import {
  fetchSupabaseUserAppState,
  upsertSupabaseUserAppState,
  subscribeSupabaseUserAppState,
  teardownSupabaseUserAppState,
} from '../supabase/userAppState';
import { isSupabaseConfigured } from '../supabase/config';
import { upsertFirebaseUserAppState, subscribeFirebaseUserAppState } from '../firebase/userAppState';
import { isFirebaseConfigured } from '../firebase/config';
import { isCloudAuthConfigured } from './config';
import { isCloudAuthUserId } from './cloudProfile';
import { hasSupabaseSessionForUser } from './activeBackend';
import { isDevLocalAuthBypass } from './devLocalAuth';

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushInFlight = false;
let applyingRemote = false;
let lastAppliedRemoteAt = 0;
let lastPushedAt = 0;
let realtimeUnsub: (() => void) | null = null;
let subscribedUserId: string | null = null;
let startCloudAppStateTask: Promise<void> | null = null;
let stopCloudAppStateTask: Promise<void> | null = null;
/** False until cloud row is fetched (or first-session prep done) — blocks uploading stale local demo data. */
let cloudSyncReady = false;
let cloudSyncHydratedUserId: string | null = null;
let hydrateGeneration = 0;

/** Device-local LWW timestamp — survives refresh so cloud hydrate cannot stomp newer IDB data. */
const LOCAL_REV_KEY = 'user_app_state_local_rev';

type LocalAppStateRev = { userId: string; updatedAt: number };

function readPersistedLocalRevision(userId: string): number {
  const rev = db.load<LocalAppStateRev>(LOCAL_REV_KEY, { userId: '', updatedAt: 0 });
  if (rev.userId !== userId) return 0;
  return typeof rev.updatedAt === 'number' ? rev.updatedAt : 0;
}

function persistLocalRevision(userId: string, updatedAt: number): void {
  const ts = Math.max(0, Math.floor(updatedAt));
  const prev = readPersistedLocalRevision(userId);
  if (ts <= prev) return;
  db.save(LOCAL_REV_KEY, { userId, updatedAt: ts });
}

function bumpLocalRevision(userId: string): number {
  const now = Date.now();
  persistLocalRevision(userId, now);
  return now;
}

/** One-time guard: existing IDB data without a revision stamp must not lose to stale cloud on refresh. */
function seedLocalRevisionIfNeeded(userId: string): void {
  if (readPersistedLocalRevision(userId) > 0) return;
  const cache = (db as unknown as { cache: Record<string, unknown> }).cache;
  const hasLocal = CLOUD_SYNC_COLLECTION_KEYS.some(
    (key) => cache[key] !== undefined && cache[key] !== null,
  );
  if (hasLocal) bumpLocalRevision(userId);
}

function resetCloudSyncSessionState(): void {
  lastAppliedRemoteAt = 0;
  lastPushedAt = 0;
  cloudSyncReady = false;
  cloudSyncHydratedUserId = null;
}

function collectPayload(store: LocalDB): CloudAppStatePayload {
  const collections: CloudAppStatePayload['collections'] = {};
  const cache = (store as unknown as { cache: Record<string, unknown> }).cache;

  for (const key of CLOUD_SYNC_COLLECTION_KEYS) {
    if (!isCloudSyncCollectionKey(key)) continue;
    const value = cache[key];
    if (value !== undefined) {
      collections[key] = value;
    }
  }

  return {
    v: CLOUD_APP_STATE_VERSION,
    updatedAt: Date.now(),
    collections,
  };
}

function applyPayloadIfNewer(payload: CloudAppStatePayload, source: 'remote' | 'bootstrap') {
  if (isDevLocalAuthBypass()) return;
  if (!payload?.updatedAt || payload.v !== CLOUD_APP_STATE_VERSION) return;
  if (source === 'remote' && payload.updatedAt <= lastAppliedRemoteAt) return;
  if (source === 'bootstrap' && payload.updatedAt <= lastPushedAt) return;

  applyingRemote = true;
  try {
    db.applyRemoteCollections(payload.collections);
    lastAppliedRemoteAt = payload.updatedAt;
  } finally {
    applyingRemote = false;
  }
}

async function pushNow(userId: string): Promise<void> {
  if (!cloudSyncReady || cloudSyncHydratedUserId !== userId) return;
  if (pushInFlight || applyingRemote) return;
  pushInFlight = true;
  try {
    const payload = collectPayload(db);
    if (payload.updatedAt <= lastAppliedRemoteAt) return;

    if (isSupabaseConfigured() && (await hasSupabaseSessionForUser(userId))) {
      await upsertSupabaseUserAppState(userId, payload);
    } else if (isFirebaseConfigured()) {
      await upsertFirebaseUserAppState(userId, payload);
    } else {
      return;
    }
    lastPushedAt = payload.updatedAt;
    lastAppliedRemoteAt = payload.updatedAt;
    persistLocalRevision(userId, payload.updatedAt);
    if (import.meta.env.DEV) {
      console.info('[sync] pushed user_app_state', {
        userId: userId.slice(0, 8),
        updatedAt: payload.updatedAt,
        keys: Object.keys(payload.collections),
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[sync] cloud app state push failed:', message, err);
  } finally {
    pushInFlight = false;
  }
}

/** Debounced push after local db.save — all catalogued collections. */
export function scheduleCloudAppStateSync(store: LocalDB = db): void {
  if (isDevLocalAuthBypass() || !isCloudAuthConfigured() || applyingRemote) return;
  const userId = store.currentUserId;
  if (!isCloudAuthUserId(userId)) return;

  const bumped = bumpLocalRevision(userId);
  lastPushedAt = Math.max(lastPushedAt, bumped);

  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushNow(userId);
  }, 700);
}

/** Push pending local changes immediately (call before account switch / sign-out). */
export async function flushCloudAppStateSync(): Promise<void> {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  const userId = db.currentUserId;
  if (!userId || !isCloudAuthUserId(userId)) return;
  await pushNow(userId);
}

export function isCloudAppStateRemoteApply(): boolean {
  return applyingRemote;
}

type HydrateResult = 'ok' | 'empty' | 'error';

type HydrateOutcome = { result: HydrateResult; pushLocal: boolean };

/** Start realtime listener + initial fetch for the signed-in cloud user. */
async function hydrateCloudAppStateForUser(
  userId: string,
  generation: number,
): Promise<HydrateOutcome> {
  if (isSupabaseConfigured() && (await hasSupabaseSessionForUser(userId))) {
    let existing: CloudAppStatePayload | null;
    let pushLocal = false;
    try {
      existing = await fetchSupabaseUserAppState(userId);
    } catch (err) {
      console.warn('[sync] fetch user_app_state failed — keeping local data:', err);
      return { result: 'error', pushLocal: false };
    }

    if (generation !== hydrateGeneration) return { result: 'error', pushLocal: false };

    if (existing) {
      const localRev = readPersistedLocalRevision(userId);
      lastPushedAt = Math.max(lastPushedAt, localRev);
      if (existing.updatedAt > localRev) {
        applyPayloadIfNewer(existing, 'bootstrap');
      } else if (localRev > existing.updatedAt) {
        lastAppliedRemoteAt = existing.updatedAt;
        pushLocal = true;
      } else {
        applyPayloadIfNewer(existing, 'bootstrap');
      }
    } else {
      db.prepareLocalStoreForFirstCloudSession(userId);
      lastPushedAt = 0;
      lastAppliedRemoteAt = 0;
      db.save(LOCAL_REV_KEY, { userId, updatedAt: 0 });
    }

    if (generation !== hydrateGeneration) return { result: 'error', pushLocal: false };

    if (realtimeUnsub) {
      realtimeUnsub();
      realtimeUnsub = null;
    }
    if (generation !== hydrateGeneration) return { result: 'error', pushLocal: false };

    realtimeUnsub = await subscribeSupabaseUserAppState(userId, (payload) => {
      applyPayloadIfNewer(payload, 'remote');
    });
    return { result: existing ? 'ok' : 'empty', pushLocal };
  }

  if (isFirebaseConfigured()) {
    if (generation !== hydrateGeneration) return { result: 'error', pushLocal: false };

    if (realtimeUnsub) {
      realtimeUnsub();
      realtimeUnsub = null;
    }

    realtimeUnsub = subscribeFirebaseUserAppState(userId, (payload) => {
      applyPayloadIfNewer(payload, 'remote');
    });
    return { result: 'ok', pushLocal: false };
  }

  return { result: 'error', pushLocal: false };
}

async function startCloudAppStateRealtimeInner(userId: string): Promise<void> {
  if (isDevLocalAuthBypass() || !isCloudAuthConfigured() || !isCloudAuthUserId(userId)) return;

  if (
    subscribedUserId === userId &&
    realtimeUnsub &&
    cloudSyncHydratedUserId === userId &&
    cloudSyncReady
  ) {
    return;
  }

  await stopCloudAppStateRealtimeAsync();
  subscribedUserId = userId;
  cloudSyncReady = false;
  cloudSyncHydratedUserId = userId;
  seedLocalRevisionIfNeeded(userId);
  lastPushedAt = readPersistedLocalRevision(userId);

  const generation = ++hydrateGeneration;
  let hydrateResult: HydrateResult;
  let pushLocalAfterHydrate = false;
  try {
    const outcome = await hydrateCloudAppStateForUser(userId, generation);
    hydrateResult = outcome.result;
    pushLocalAfterHydrate = outcome.pushLocal;
  } catch (err) {
    console.warn('[sync] cloud app state hydrate failed:', err);
    hydrateResult = 'error';
  }

  if (generation !== hydrateGeneration) return;
  cloudSyncReady = hydrateResult !== 'error';
  if (pushLocalAfterHydrate && cloudSyncReady) {
    queueMicrotask(() => void pushNow(userId));
  }
  if (hydrateResult === 'error') {
    window.setTimeout(() => {
      void (async () => {
        if (subscribedUserId !== userId || generation !== hydrateGeneration) return;
        const retry = await hydrateCloudAppStateForUser(userId, generation);
        if (generation !== hydrateGeneration) return;
        if (retry.result !== 'error' && subscribedUserId === userId) {
          cloudSyncReady = true;
          if (retry.pushLocal) {
            queueMicrotask(() => void pushNow(userId));
          }
          queueMicrotask(() => {
            void import('../walletKstarSync').then(({ onUserSessionActive }) => {
              onUserSessionActive(userId);
            });
          });
        }
      })();
    }, 5000);
    window.setTimeout(() => {
      if (subscribedUserId === userId && !cloudSyncReady) {
        cloudSyncReady = true;
      }
    }, 15000);
  }
  if (hydrateResult !== 'error' && generation === hydrateGeneration) {
    queueMicrotask(() => {
      void import('../walletKstarSync').then(({ onUserSessionActive }) => {
        onUserSessionActive(userId);
      });
    });
  }
  if (import.meta.env.DEV) {
    console.info('[sync] cloud app state ready', {
      userId: userId.slice(0, 8),
      hydrateResult,
      cloudSyncReady,
    });
  }
}

export async function startCloudAppStateRealtime(userId: string): Promise<void> {
  if (stopCloudAppStateTask) {
    await stopCloudAppStateTask;
  }

  if (startCloudAppStateTask) {
    await startCloudAppStateTask;
    if (
      subscribedUserId === userId &&
      realtimeUnsub &&
      cloudSyncHydratedUserId === userId &&
      cloudSyncReady
    ) {
      return;
    }
  }

  startCloudAppStateTask = startCloudAppStateRealtimeInner(userId);
  try {
    await startCloudAppStateTask;
  } finally {
    startCloudAppStateTask = null;
  }
}

export function stopCloudAppStateRealtime(): void {
  void stopCloudAppStateRealtimeAsync();
}

export async function stopCloudAppStateRealtimeAsync(): Promise<void> {
  if (stopCloudAppStateTask) {
    await stopCloudAppStateTask;
    return;
  }

  stopCloudAppStateTask = (async () => {
    hydrateGeneration += 1;
    const userId = subscribedUserId;
    if (realtimeUnsub) {
      realtimeUnsub();
      realtimeUnsub = null;
    }
    if (userId) {
      await teardownSupabaseUserAppState(userId);
    }
    subscribedUserId = null;
    if (pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
    }
    resetCloudSyncSessionState();
  })().finally(() => {
    stopCloudAppStateTask = null;
  });

  await stopCloudAppStateTask;
}

export function getCloudAppStateSubscribedUserId(): string | null {
  return subscribedUserId;
}
