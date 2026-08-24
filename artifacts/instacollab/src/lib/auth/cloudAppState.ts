import {
  USER_APP_STATE_KEYS,
  isUserAppStateKey,
} from '../cloudSync/collectionKeys';
import {
  CLOUD_APP_STATE_VERSION,
  type CloudAppStatePayload,
  type UserAppStateV2Payload,
} from '../cloudSync/types';
import {
  buildUserAppStateV2FromLocal,
  extractAllowedSettings,
  normalizeToUserAppStateV2,
} from '../cloudSync/userAppStateMigrate';
import { db } from '../db/localDb';
import type { LocalDB } from '../db/localDbType';
import {
  fetchSupabaseUserAppState,
  upsertSupabaseUserAppState,
  subscribeSupabaseUserAppState,
  teardownSupabaseUserAppState,
} from '../supabase/userAppState';
import { isSupabaseConfigured } from '../supabase/config';
import { isFirebaseConfigured } from '../firebase/config';
import { isCloudAuthConfigured } from './config';
import { resolveCloudDataBackend, markSupabaseCloudDegradedFromError } from './cloudDataBackend';
import { isCloudAppStateRemoteApply, withCloudAppStateRemoteApply } from './cloudAppStateFlags';
import { isCloudAuthUserId } from './cloudProfile';
import { consumePendingDemoMigration, resolveDemoSessionEmail } from './demoCloudMigration';
import { isDevLocalAuthBypass } from './devLocalAuth';
import { scheduleLiveSessionSync } from '../liveSessionSync';
import { isNetworkOnline, subscribeNetworkStatus } from '../networkStatus';
import { LIVE_CLOUD_SYNC_REALTIME } from '../liveCloudSyncMode';

async function firebaseUserAppState() {
  return import('../firebase/userAppState');
}
let pushInFlight = false;
let pushAgainAfterFlight = false;
let syncMicrotaskQueued = false;
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
  const hasLocal = USER_APP_STATE_KEYS.some(
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

function collectPayload(store: LocalDB, revision: number): UserAppStateV2Payload {
  const cache = (store as unknown as { cache: Record<string, unknown> }).cache;
  const settings: Partial<Record<(typeof USER_APP_STATE_KEYS)[number], unknown>> = {};

  for (const key of USER_APP_STATE_KEYS) {
    if (!isUserAppStateKey(key)) continue;
    const value = cache[key];
    if (value !== undefined) {
      settings[key] = value;
    }
  }

  return buildUserAppStateV2FromLocal(settings, revision);
}

function applyPayloadIfNewer(payload: CloudAppStatePayload, source: 'remote' | 'bootstrap') {
  if (isDevLocalAuthBypass()) return;
  const normalized = normalizeToUserAppStateV2(payload);
  if (!normalized?.updatedAt) return;
  if (source === 'remote' && normalized.updatedAt <= lastAppliedRemoteAt) return;
  if (source === 'bootstrap' && normalized.updatedAt <= lastPushedAt) return;

  withCloudAppStateRemoteApply(() => {
    // v2 applies AS-only settings — never overwrite CU/EP/financial collections from cloud blob.
    db.applyRemoteCollections(normalized.settings as Partial<Record<string, unknown>>);
    lastAppliedRemoteAt = normalized.updatedAt;
  });
}

async function pushNow(userId: string): Promise<void> {
  if (!isNetworkOnline()) return;
  if (!cloudSyncReady || cloudSyncHydratedUserId !== userId) return;
  if (pushInFlight) {
    pushAgainAfterFlight = true;
    return;
  }
  pushInFlight = true;
  try {
    const revision = readPersistedLocalRevision(userId);
    const payload = collectPayload(db, revision);
    if (payload.updatedAt <= lastAppliedRemoteAt) return;

    const backend = await resolveCloudDataBackend(userId);
    if (backend === 'supabase') {
      await upsertSupabaseUserAppState(userId, payload);
    } else if (isFirebaseConfigured()) {
      const { upsertFirebaseUserAppState } = await firebaseUserAppState();
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
        keys: Object.keys(payload.settings),
      });
    }
  } catch (err) {
    markSupabaseCloudDegradedFromError(err);
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[sync] cloud app state push failed:', message, err);
    if (isFirebaseConfigured()) {
      try {
        const payload = collectPayload(db, readPersistedLocalRevision(userId));
        const { upsertFirebaseUserAppState } = await firebaseUserAppState();
        await upsertFirebaseUserAppState(userId, payload);
        lastPushedAt = payload.updatedAt;
        lastAppliedRemoteAt = payload.updatedAt;
        persistLocalRevision(userId, payload.updatedAt);
      } catch (retryErr) {
        console.warn('[sync] firebase app state push retry failed:', retryErr);
      }
    }
  } finally {
    pushInFlight = false;
    if (pushAgainAfterFlight) {
      pushAgainAfterFlight = false;
      queueMicrotask(() => void pushNow(userId));
    }
  }
}

/** AS-only keys that push immediately on change. CU/EP/financial keys use dedicated server lanes. */
const INSTANT_CLOUD_SYNC_KEYS = new Set<string>(USER_APP_STATE_KEYS);

function queueCloudPush(userId: string, urgent = false): void {
  const run = () => void pushNow(userId);
  // Realtime mode: every collection push is microtask-urgent (no batch wait).
  if (urgent || LIVE_CLOUD_SYNC_REALTIME) {
    queueMicrotask(run);
    return;
  }
  if (syncMicrotaskQueued) return;
  syncMicrotaskQueued = true;
  queueMicrotask(() => {
    syncMicrotaskQueued = false;
    run();
  });
}

/** Push after local db.save — microtask batching (no debounce delay). */
export function scheduleCloudAppStateSync(store: LocalDB = db, changedKey?: string): void {
  if (isDevLocalAuthBypass() || !isCloudAuthConfigured() || isCloudAppStateRemoteApply()) return;
  // Only AS keys may enter user_app_state v2 sync.
  if (changedKey && !isUserAppStateKey(changedKey)) return;

  const userId = store.currentUserId;
  if (!isCloudAuthUserId(userId)) return;

  const bumped = bumpLocalRevision(userId);
  lastPushedAt = Math.max(lastPushedAt, bumped);

  if (!isNetworkOnline()) return;

  queueCloudPush(
    userId,
    LIVE_CLOUD_SYNC_REALTIME || (changedKey ? INSTANT_CLOUD_SYNC_KEYS.has(changedKey) : false),
  );
}

/** Push pending local changes immediately (call before account switch / sign-out). */
export async function flushCloudAppStateSync(): Promise<void> {
  syncMicrotaskQueued = false;
  const userId = db.currentUserId;
  if (!userId || !isCloudAuthUserId(userId)) return;
  await pushNow(userId);
}
type HydrateResult = 'ok' | 'empty' | 'error';

type HydrateOutcome = { result: HydrateResult; pushLocal: boolean };

/** Start realtime listener + initial fetch for the signed-in cloud user. */
async function hydrateCloudAppStateForUser(
  userId: string,
  generation: number,
): Promise<HydrateOutcome> {
  if (!isNetworkOnline()) {
    seedLocalRevisionIfNeeded(userId);
    lastPushedAt = readPersistedLocalRevision(userId);
    return { result: 'ok', pushLocal: false };
  }

  const backend = await resolveCloudDataBackend(userId);
  if (generation !== hydrateGeneration) return { result: 'error', pushLocal: false };

  if (backend === 'supabase') {
    let existing: CloudAppStatePayload | null;
    let pushLocal = false;
    try {
      existing = await fetchSupabaseUserAppState(userId);
    } catch (err) {
      markSupabaseCloudDegradedFromError(err);
      console.warn('[sync] fetch user_app_state failed — trying Firebase:', err);
      if (isFirebaseConfigured()) {
        return hydrateFirebaseAppState(userId, generation);
      }
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
      let appliedDemoMigration = false;
      if (isSupabaseConfigured()) {
        const sessionEmail = await resolveDemoSessionEmail(userId);
        const pending = sessionEmail ? consumePendingDemoMigration(sessionEmail) : null;
        if (pending?.collections && Object.keys(pending.collections).length > 0) {
          db.applyRemoteCollections(extractAllowedSettings(pending.collections));
          persistLocalRevision(userId, pending.updatedAt);
          lastPushedAt = Math.max(lastPushedAt, pending.updatedAt);
          lastAppliedRemoteAt = 0;
          appliedDemoMigration = true;
          pushLocal = true;
        }
      }
      if (!appliedDemoMigration) {
        db.prepareLocalStoreForFirstCloudSession(userId);
        lastPushedAt = 0;
        lastAppliedRemoteAt = 0;
        db.save(LOCAL_REV_KEY, { userId, updatedAt: 0 });
      }
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
    return hydrateFirebaseAppState(userId, generation);
  }

  return { result: 'error', pushLocal: false };
}

async function hydrateFirebaseAppState(
  userId: string,
  generation: number,
): Promise<HydrateOutcome> {
  if (generation !== hydrateGeneration) return { result: 'error', pushLocal: false };

  const {
    fetchFirebaseUserAppState,
    subscribeFirebaseUserAppState,
  } = await firebaseUserAppState();

  let existing: CloudAppStatePayload | null = null;
  let pushLocal = false;
  try {
    existing = await fetchFirebaseUserAppState(userId);
  } catch (err) {
    console.warn('[sync] fetch Firestore user_app_state failed:', err);
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
    seedLocalRevisionIfNeeded(userId);
    pushLocal = readPersistedLocalRevision(userId) > 0;
  }

  if (generation !== hydrateGeneration) return { result: 'error', pushLocal: false };

  if (realtimeUnsub) {
    realtimeUnsub();
    realtimeUnsub = null;
  }

  realtimeUnsub = subscribeFirebaseUserAppState(userId, (payload) => {
    applyPayloadIfNewer(payload, 'remote');
  });
  return { result: existing ? 'ok' : 'empty', pushLocal };
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
    // Immediate retry — no 500ms / 3s artificial wait.
    queueMicrotask(() => {
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
            scheduleLiveSessionSync(userId);
          });
        }
        // Failed hydration must not enable push — stale local must not overwrite unknown cloud AS.
      })();
    });
  }
  if (hydrateResult !== 'error' && generation === hydrateGeneration) {
    queueMicrotask(() => {
      scheduleLiveSessionSync(userId);
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
    syncMicrotaskQueued = false;
    pushAgainAfterFlight = false;
    resetCloudSyncSessionState();
  })().finally(() => {
    stopCloudAppStateTask = null;
  });

  await stopCloudAppStateTask;
}

/** Force re-hydrate from Supabase after silent outage recovery. */
export async function restartCloudAppStateSync(userId: string): Promise<void> {
  subscribedUserId = null;
  cloudSyncHydratedUserId = null;
  cloudSyncReady = false;
  await stopCloudAppStateRealtimeAsync();
  await startCloudAppStateRealtime(userId);
}

export function getCloudAppStateSubscribedUserId(): string | null {
  return subscribedUserId;
}

let networkResumeInstalled = false;

/** Re-hydrate and flush pending local changes when connectivity returns. */
export function initCloudAppStateNetworkResume(): void {
  if (networkResumeInstalled || typeof window === 'undefined') return;
  networkResumeInstalled = true;

  subscribeNetworkStatus((next) => {
    if (next !== 'online') return;
    const userId = subscribedUserId;
    if (!userId || !isCloudAuthUserId(userId)) return;
    void (async () => {
      const outcome = await hydrateCloudAppStateForUser(userId, ++hydrateGeneration);
      if (outcome.result !== 'error') {
        cloudSyncReady = true;
        if (outcome.pushLocal) {
          queueMicrotask(() => void pushNow(userId));
        }
      }
      scheduleLiveSessionSync(userId);
    })();
  });
}
