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

/** Start realtime listener + initial fetch for the signed-in cloud user. */
async function hydrateCloudAppStateForUser(
  userId: string,
  generation: number,
): Promise<HydrateResult> {
  if (isSupabaseConfigured() && (await hasSupabaseSessionForUser(userId))) {
    let existing: CloudAppStatePayload | null;
    try {
      existing = await fetchSupabaseUserAppState(userId);
    } catch (err) {
      console.warn('[sync] fetch user_app_state failed — keeping local data:', err);
      return 'error';
    }

    if (generation !== hydrateGeneration) return 'error';

    if (existing) {
      applyPayloadIfNewer(existing, 'bootstrap');
    } else {
      db.prepareLocalStoreForFirstCloudSession(userId);
      lastPushedAt = 0;
      lastAppliedRemoteAt = 0;
    }

    if (generation !== hydrateGeneration) return 'error';

    if (realtimeUnsub) {
      realtimeUnsub();
      realtimeUnsub = null;
    }
    if (generation !== hydrateGeneration) return 'error';

    realtimeUnsub = await subscribeSupabaseUserAppState(userId, (payload) => {
      applyPayloadIfNewer(payload, 'remote');
    });
    return existing ? 'ok' : 'empty';
  }

  if (isFirebaseConfigured()) {
    if (generation !== hydrateGeneration) return 'error';

    if (realtimeUnsub) {
      realtimeUnsub();
      realtimeUnsub = null;
    }

    realtimeUnsub = subscribeFirebaseUserAppState(userId, (payload) => {
      applyPayloadIfNewer(payload, 'remote');
    });
    return 'ok';
  }

  return 'error';
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

  const generation = ++hydrateGeneration;
  let hydrateResult: HydrateResult;
  try {
    hydrateResult = await hydrateCloudAppStateForUser(userId, generation);
  } catch (err) {
    console.warn('[sync] cloud app state hydrate failed:', err);
    hydrateResult = 'error';
  }

  if (generation !== hydrateGeneration) return;
  cloudSyncReady = hydrateResult !== 'error';
  if (hydrateResult === 'error') {
    window.setTimeout(() => {
      void (async () => {
        if (subscribedUserId !== userId || generation !== hydrateGeneration) return;
        const retry = await hydrateCloudAppStateForUser(userId, generation);
        if (generation !== hydrateGeneration) return;
        if (retry !== 'error' && subscribedUserId === userId) {
          cloudSyncReady = true;
        }
      })();
    }, 5000);
    window.setTimeout(() => {
      if (subscribedUserId === userId && !cloudSyncReady) {
        cloudSyncReady = true;
      }
    }, 15000);
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
