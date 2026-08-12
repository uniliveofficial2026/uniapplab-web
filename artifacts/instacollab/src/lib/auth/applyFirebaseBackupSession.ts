import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../db/localDb';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/config';
import {
  fetchProfile,
  profileRowToUser,
} from '../supabase/profile';
import type { ProfileRow } from '../supabase/types';
import { withTimeout } from '../supabase/withTimeout';
import { fetchFirebaseProfile, userFromFirebaseUser } from '../firebase/profile';
import { writeStoredAuthBackend } from './providerState';
import { syncDeviceAccountForAppUser } from './deviceAccounts';
import { startCloudAppStateRealtime } from './cloudAppState';
import { bootstrapCloudSystemsAfterAuth } from '../appCloudSystems';
import { isSupabaseAuthUserId } from './activeBackend';
import {
  isFirebaseBackupSessionActive,
  resolveLinkedSupabaseUserId,
  saveFirebaseBackupLink,
} from './firebaseBackupLink';
import { loadStoredAccountSession } from './storedAccountSessions';
import { initThoughtNoteCloudSync } from '../thoughtNoteCloudSync';
import { startLiveCloudSurfaces } from '../liveCloudSurfaces';

const DB_READY_MS = 2_500;
const PROFILE_MS = 8_000;

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop';

function slugUsername(email: string | null | undefined, uid: string): string {
  const base = (email?.split('@')[0] || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (base.length >= 3) return base.slice(0, 24);
  return `user_${uid.replace(/-/g, '').slice(0, 8)}`;
}

function minimalProfileFromFirebase(
  supabaseUserId: string,
  firebaseUser: FirebaseUser,
): ProfileRow {
  const username = slugUsername(firebaseUser.email, supabaseUserId);
  return {
    id: supabaseUserId,
    username,
    display_name: firebaseUser.displayName?.trim() || username,
    avatar_url: firebaseUser.photoURL,
    bio: '',
    profile_setup_complete: false,
    public_user_id: username,
    public_user_id_changed_at: new Date().toISOString(),
  };
}

async function tryRefreshStoredSupabaseSession(userId: string): Promise<void> {
  const stored = loadStoredAccountSession(userId);
  if (!stored) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await withTimeout(
    supabase.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
    }),
    PROFILE_MS,
    'Supabase setSession',
  ).catch(() => undefined);
}

/**
 * Apply Firebase OAuth (backup lane) without changing Supabase user ids or writing duplicate profiles.
 */
export async function applyFirebaseOAuthSessionToLocalDb(
  firebaseUser: FirebaseUser,
  _options?: { silent?: boolean },
): Promise<void> {
  await withTimeout(db.whenStorageReady(), DB_READY_MS, 'Local storage').catch(() => undefined);

  const linkedSupabaseId =
    isSupabaseConfigured() ? resolveLinkedSupabaseUserId(firebaseUser) : null;

  if (linkedSupabaseId && isSupabaseAuthUserId(linkedSupabaseId)) {
    saveFirebaseBackupLink({
      firebaseUid: firebaseUser.uid,
      supabaseUserId: linkedSupabaseId,
      email: firebaseUser.email || '',
    });

    await tryRefreshStoredSupabaseSession(linkedSupabaseId);

    const cached = db.users.find((user) => user.id === linkedSupabaseId) ?? null;
    let profile = await withTimeout(
      fetchProfile(linkedSupabaseId),
      PROFILE_MS,
      'Supabase profile fetch',
    ).catch(() => null);

    if (!profile && cached) {
      profile = minimalProfileFromFirebase(linkedSupabaseId, firebaseUser);
      if (cached.username) profile.username = cached.username;
      if (cached.displayName) profile.display_name = cached.displayName;
      if (cached.avatarUrl) profile.avatar_url = cached.avatarUrl;
      if (cached.bio) profile.bio = cached.bio;
      profile.profile_setup_complete = Boolean(
        (cached as { profileSetupComplete?: boolean }).profileSetupComplete,
      );
    } else if (!profile) {
      profile = minimalProfileFromFirebase(linkedSupabaseId, firebaseUser);
    }

    const appUser = profileRowToUser(profile, firebaseUser.email);
    db.syncAuthUser(appUser);
    syncDeviceAccountForAppUser({
      ...appUser,
      email: firebaseUser.email ?? undefined,
    });
    writeStoredAuthBackend('firebase');
    db.advanceLaunchProgressAfterLogin(Boolean(profile.profile_setup_complete));

    initThoughtNoteCloudSync();
    void startCloudAppStateRealtime(linkedSupabaseId);
    startLiveCloudSurfaces(linkedSupabaseId);
    bootstrapCloudSystemsAfterAuth();
    return;
  }

  const profile = await withTimeout(
    fetchFirebaseProfile(firebaseUser.uid),
    PROFILE_MS,
    'Firebase profile fetch',
  ).catch(() => null);
  const appUser = userFromFirebaseUser(firebaseUser, profile);
  db.syncAuthUser(appUser);
  syncDeviceAccountForAppUser({
    ...appUser,
    email: firebaseUser.email ?? undefined,
  });
  writeStoredAuthBackend('firebase');
  db.advanceLaunchProgressAfterLogin(Boolean(profile?.profile_setup_complete));
  void startCloudAppStateRealtime(appUser.id);
  bootstrapCloudSystemsAfterAuth();
}

export function isFirebaseOAuthBackupForUser(userId: string): boolean {
  return isFirebaseBackupSessionActive(userId);
}
