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
import { withTimeout } from '../supabase/withTimeout';
import { isDevLocalAuthBypass } from './devLocalAuth';
import { isNetworkOnline } from '../networkStatus';
import { startCloudAppStateRealtime, stopCloudAppStateRealtime } from './cloudAppState';
import { isCloudAuthUserId } from './cloudProfile';
import { clearSupabaseUnhealthy, writeStoredAuthBackend } from './providerState';
import { syncDeviceAccountForAppUser } from './deviceAccounts';
import {
  clearStoredAccountSession,
  loadStoredAccountSession,
  saveStoredAccountSession,
} from './storedAccountSessions';
import { initThoughtNoteCloudSync, teardownThoughtNoteCloudSync } from '../thoughtNoteCloudSync';
import { startCloudChatRealtime, stopCloudChatRealtime } from '../chat/cloudChatSync';
import { syncLiveSessionData } from '../liveSessionSync';
import { bootstrapCloudSystemsAfterAuth } from '../appCloudSystems';

const DB_READY_MS = 8_000;
const PROFILE_MS = 12_000;

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
export async function applySupabaseSessionToLocalDb(session: Session | null): Promise<void> {
  await withTimeout(db.whenStorageReady(), DB_READY_MS, 'Local storage');

  if (isDevLocalAuthBypass() && db.isLoggedIn) {
    return;
  }

  if (!session?.user) {
    if (isDevLocalAuthBypass() && db.isLoggedIn) return;
    // Ignore stale SIGNED_OUT during account switch — a newer session may already exist.
    const supabase = getSupabaseClient();
    if (supabase && isNetworkOnline()) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) return;
    }
    stopProfileRealtime();
    stopCloudAppStateRealtime();
    db.logout();
    return;
  }

  if (!isNetworkOnline()) {
    const userId = session.user.id;
    const existing = db.users.find((u) => u.id === userId);
    if (existing) {
      db.syncAuthUser(existing);
    } else {
      db.syncAuthUser(userFromSession(session, null));
    }
    syncDeviceAccountForAppUser({
      ...(db.users.find((u) => u.id === userId) ?? userFromSession(session, null)),
      email: session.user.email ?? undefined,
    });
    startProfileRealtime(userId);
    initThoughtNoteCloudSync();
    await startCloudAppStateRealtime(userId);
    void startCloudChatRealtime(userId);
    return;
  }

  let profile = await withTimeout(
    fetchProfile(session.user.id),
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
  saveStoredAccountSession(session.user.id, session);
  db.advanceLaunchProgressAfterLogin(Boolean(profile?.profile_setup_complete));
  writeStoredAuthBackend('supabase');
  clearSupabaseUnhealthy();

  startProfileRealtime(appUser.id);
  initThoughtNoteCloudSync();
  await startCloudAppStateRealtime(appUser.id);
  void startCloudChatRealtime(appUser.id);
  await syncLiveSessionData(appUser.id);
  bootstrapCloudSystemsAfterAuth();
}

/** Restore a previously saved per-account Supabase session (seamless account switch). */
export async function restoreStoredAccountSession(
  uid: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: 'Supabase is not configured.' };
  }

  const stored = loadStoredAccountSession(uid);
  if (!stored) {
    return { ok: false, reason: 'No saved session for this account on this device.' };
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
  });

  if (error || !data.session?.user) {
    clearStoredAccountSession(uid);
    return {
      ok: false,
      reason: error?.message ?? 'Saved session expired. Sign in again for this account.',
    };
  }

  if (data.session.user.id !== uid) {
    return { ok: false, reason: 'Saved session does not match this account.' };
  }

  saveStoredAccountSession(uid, data.session);
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
  stopCloudChatRealtime();
  teardownThoughtNoteCloudSync();
}
