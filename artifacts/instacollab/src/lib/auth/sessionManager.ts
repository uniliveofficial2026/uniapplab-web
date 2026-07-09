/**
 * Bridges Supabase Auth sessions → local db + realtime sync.
 */
import type { Session } from '@supabase/supabase-js';
import { db } from '../db/localDb';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/config';
import {
  ensureProfileFromSession,
  fetchProfile,
  profileRowToUser,
  subscribeProfileRow,
  userFromSession,
} from '../supabase/profile';
import type { ProfileRow } from '../supabase/types';
import { NET_AUTH_MS, NET_HYDRATE_MS, withTimeout } from '../networkPolicy';
import { isDevLocalAuthBypass } from './devLocalAuth';
import { isNetworkOnline } from '../networkStatus';
import { startCloudAppStateRealtime, stopCloudAppStateRealtime } from './cloudAppState';
import { isCloudAuthUserId } from './cloudProfile';
import { clearSupabaseUnhealthy, writeStoredAuthBackend } from './providerState';
import { syncDeviceAccountForAppUser } from './deviceAccounts';
import {
  clearStoredAccountSession,
  loadStoredAccountSession,
  resolveAppUserIdForDeviceAccount,
  saveStoredAccountSession,
  saveStoredAccountSessionMirrored,
  sessionLookupUids,
} from './storedAccountSessions';
import { initThoughtNoteCloudSync } from '../thoughtNoteCloudSync';
import { syncLiveSessionData } from '../liveSessionSync';
import { bootstrapCloudSystemsAfterAuth } from '../appCloudSystems';
import {
  startLiveCloudSurfaces,
  stopLiveCloudSurfaces,
} from '../liveCloudSurfaces';
import { shouldIgnoreSupabaseSignedOut } from './silentAuthSwitch';

const DB_READY_MS = NET_AUTH_MS;
const PROFILE_MS = NET_HYDRATE_MS;

let profileRealtimeUnsub: (() => void) | null = null;

function stopProfileRealtime(): void {
  profileRealtimeUnsub?.();
  profileRealtimeUnsub = null;
}

function startProfileRealtime(userId: string): void {
  stopProfileRealtime();
  if (!isSupabaseConfigured() || !isCloudAuthUserId(userId)) return;

  profileRealtimeUnsub = subscribeProfileRow(userId, (row: ProfileRow) => {
    const me = db.currentUser;
    if (!me || me.id !== userId) return;
    const merged = profileRowToUser(row);
    const localAvatar = me.avatarUrl?.trim() ?? '';
    const cloudAvatar = row.avatar_url?.trim() ?? '';
    const keepLocalAvatar =
      (localAvatar.startsWith('data:') || localAvatar.startsWith('blob:')) &&
      !cloudAvatar;
    db.syncAuthUser({
      ...me,
      username: merged.username,
      displayName: merged.displayName,
      avatarUrl: keepLocalAvatar ? me.avatarUrl : merged.avatarUrl,
      bio: merged.bio,
      publicUserId: merged.publicUserId,
      publicUserIdChangedAt: merged.publicUserIdChangedAt,
      role: merged.role,
      bannedAt: merged.bannedAt,
      banReason: merged.banReason,
      mutedUntil: merged.mutedUntil,
      note: merged.note,
      noteUpdatedAt: merged.noteUpdatedAt,
    });
    if (row.profile_setup_complete && !db.getLaunchProgress().profileSetupComplete) {
      db.advanceLaunchProgressAfterLogin(true);
    }
  });
}

/** Apply (or clear) Supabase session into the local store and wire realtime channels. */
export async function applySupabaseSessionToLocalDb(
  session: Session | null,
  _options?: { silent?: boolean },
): Promise<void> {
  // Don't hang on slow IDB — localStorage mirror already seeds the cache.
  await withTimeout(db.whenStorageReady(), DB_READY_MS, 'Local storage').catch(() => undefined);

  if (isDevLocalAuthBypass() && db.isLoggedIn) {
    return;
  }

  if (!session?.user) {
    if (shouldIgnoreSupabaseSignedOut()) {
      return;
    }
    if (isDevLocalAuthBypass() && db.isLoggedIn) return;
    // Ignore stale SIGNED_OUT during account switch — a newer session may already exist.
    const supabase = getSupabaseClient();
    if (supabase && isNetworkOnline()) {
      const { data } = await withTimeout(
        supabase.auth.getSession(),
        DB_READY_MS,
        'Supabase getSession',
      ).catch(() => ({ data: { session: null as Session | null } }));
      if (data.session?.user) return;
    }
    // Offline: never wipe local cache/session — keep working from IDB.
    if (!isNetworkOnline() && db.isLoggedIn) {
      return;
    }
    stopProfileRealtime();
    stopCloudAppStateRealtime();
    stopLiveCloudSurfaces();
    db.logout();
    return;
  }

  // ── Cache-first: paint local user immediately, then live cloud in background ──
  const userId = session.user.id;
  const cached = db.users.find((u) => u.id === userId);
  const instantUser = cached ?? userFromSession(session, null);
  db.syncAuthUser(instantUser);
  syncDeviceAccountForAppUser({
    ...instantUser,
    email: session.user.email ?? undefined,
  });
  saveStoredAccountSessionMirrored(userId, session);
  writeStoredAuthBackend('supabase');

  if (!isNetworkOnline()) {
    startProfileRealtime(userId);
    initThoughtNoteCloudSync();
    void startCloudAppStateRealtime(userId);
    startLiveCloudSurfaces(userId);
    bootstrapCloudSystemsAfterAuth();
    return;
  }

  // Live cloud hydrate — never blocks first UI frame.
  void (async () => {
    let profile = await withTimeout(
      fetchProfile(userId),
      PROFILE_MS,
      'Profile fetch',
    ).catch(() => null);

    if (!profile) {
      profile = await withTimeout(
        ensureProfileFromSession(session),
        PROFILE_MS,
        'Profile ensure',
      ).catch(() => null);
    }

    const appUser = userFromSession(session, profile);
    db.syncAuthUser(appUser);
    syncDeviceAccountForAppUser({
      ...appUser,
      email: session.user.email ?? undefined,
    });
    db.advanceLaunchProgressAfterLogin(Boolean(profile?.profile_setup_complete));
    clearSupabaseUnhealthy();

    startProfileRealtime(appUser.id);
    initThoughtNoteCloudSync();
    void startCloudAppStateRealtime(appUser.id);
    startLiveCloudSurfaces(appUser.id);
    void syncLiveSessionData(appUser.id);
    bootstrapCloudSystemsAfterAuth();
  })();
}

/** Restore a previously saved per-account Supabase session (seamless account switch). */
export async function restoreStoredAccountSession(
  uid: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: 'Supabase is not configured.' };
  }

  const lookupUids = sessionLookupUids(uid);
  const stored = lookupUids
    .map((id) => loadStoredAccountSession(id))
    .find((row) => row?.access_token && row.refresh_token);
  if (!stored) {
    return { ok: false, reason: 'No saved session for this account on this device.' };
  }

  let data: { session: Session | null; user: Session['user'] | null };
  let error: { message: string } | null;
  try {
    const result = await withTimeout(
      supabase.auth.setSession({
        access_token: stored.access_token,
        refresh_token: stored.refresh_token,
      }),
      NET_AUTH_MS,
      'Supabase setSession',
    );
    data = result.data;
    error = result.error;
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'Session switch timed out.',
    };
  }

  if (error || !data.session?.user) {
    for (const id of lookupUids) clearStoredAccountSession(id);
    return {
      ok: false,
      reason: error?.message ?? 'Saved session expired. Sign in again for this account.',
    };
  }

  const sessionUserId = data.session.user.id;
  const allowedIds = new Set([
    ...lookupUids,
    resolveAppUserIdForDeviceAccount(uid),
    sessionUserId,
  ]);
  if (!allowedIds.has(sessionUserId)) {
    return { ok: false, reason: 'Saved session does not match this account.' };
  }

  saveStoredAccountSessionMirrored(sessionUserId, data.session);
  for (const id of lookupUids) {
    if (id !== sessionUserId) saveStoredAccountSessionMirrored(id, data.session);
  }
  await applySupabaseSessionToLocalDb(data.session);
  return { ok: true };
}

export async function restoreSupabaseSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function subscribeSupabaseAuthChanges(handlers: {
  onRecovery: () => void;
  onSession: (session: Session | null) => void;
}): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      handlers.onRecovery();
      return;
    }
    if (event === 'SIGNED_OUT') {
      handlers.onSession(null);
      return;
    }
    if (session?.user) {
      handlers.onSession(session);
    }
  });

  return () => subscription.unsubscribe();
}

export function teardownCloudSession(): void {
  stopProfileRealtime();
  stopCloudAppStateRealtime();
  stopLiveCloudSurfaces();
}
