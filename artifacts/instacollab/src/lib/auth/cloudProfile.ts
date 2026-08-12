import type { User } from '../../types';
import type { ProfileRow } from '../supabase/types';
import { resolvePublicUserId } from '../publicUserId';
import { isFirebaseConfigured } from '../firebase/config';
import {
  fetchProfile,
  isPublicUserIdAvailable as isSupabasePublicUserIdAvailable,
  isUsernameAvailable as isSupabaseUsernameAvailable,
  upsertProfile,
} from '../supabase/profile';
import { isSupabaseConfigured } from '../supabase/config';
import {
  hasSupabaseSessionForUser,
  isPermissionDeniedError,
  isSupabaseAuthUserId,
  resolveActiveProfileBackend,
} from './activeBackend';
import { avatarUrlForCloudUpload } from './cloudAvatar';
import { mapProfileSaveError } from './profileErrors';
import { isInfrastructureAuthFailure } from './failover';
import { markSupabaseCloudDegradedFromError } from './cloudDataBackend';
import { clearSupabaseUnhealthy, markSupabaseUnhealthy, writeStoredAuthBackend } from './providerState';
import { isCloudAuthConfigured } from './config';
import { isCloudAppStateRemoteApply } from './cloudAppStateFlags';
import { isNetworkOnline } from '../networkStatus';
import {
  firebaseProfileDocIdForUser,
  identityOwnerIds,
  readFirebaseBackupLink,
} from './firebaseBackupLink';

async function firebaseProfileApi() {
  return import('../firebase/profile');
}

export function isCloudAuthUserId(userId: string): boolean {
  if (/^u\d+$/i.test(userId)) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return true;
  }
  return /^[a-zA-Z0-9]{20,128}$/.test(userId);
}

/** @deprecated use isCloudAuthUserId */
export const isRemoteAuthUserId = isCloudAuthUserId;

function normalizeUsername(raw: string, userId: string): string {
  const base = raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (base.length >= 3) return base.slice(0, 24);
  return `user_${userId.replace(/-/g, '').slice(0, 8)}`;
}

async function upsertProfileOnBackend(
  backend: 'supabase' | 'firebase',
  row: ProfileRow
): Promise<void> {
  if (backend === 'firebase') {
    const { upsertFirebaseProfile } = await firebaseProfileApi();
    await upsertFirebaseProfile(row);
    return;
  }
  await upsertProfile(row);
}

async function fetchProfileOnBackend(
  backend: 'supabase' | 'firebase',
  userId: string
): Promise<ProfileRow | null> {
  if (backend === 'firebase') {
    const { fetchFirebaseProfile } = await firebaseProfileApi();
    return fetchFirebaseProfile(userId);
  }
  return fetchProfile(userId);
}

export async function isCloudPublicUserIdAvailable(
  publicUserId: string,
  exceptUserId?: string
): Promise<boolean> {
  const normalized = publicUserId.trim();
  if (!normalized) return false;

  const owners = exceptUserId ? identityOwnerIds(exceptUserId) : [];
  const checks: Array<Promise<boolean>> = [];

  if (isSupabaseConfigured()) {
    checks.push(isSupabasePublicUserIdAvailable(publicUserId, owners));
  }
  if (isFirebaseConfigured()) {
    checks.push(
      (async () => {
        const { isFirebasePublicUserIdAvailable } = await firebaseProfileApi();
        return isFirebasePublicUserIdAvailable(publicUserId, owners);
      })(),
    );
  }

  // No cloud backends — treat as available (local check handles uniqueness).
  if (checks.length === 0) return true;

  try {
    const results = await Promise.all(checks);
    // Must be free on every configured backend.
    return results.every(Boolean);
  } catch (err) {
    // Fail closed: never allow set/change when we cannot verify uniqueness.
    console.warn('[auth] public user id availability check failed (blocking):', err);
    return false;
  }
}

export async function isCloudUsernameAvailable(
  username: string,
  exceptUserId?: string
): Promise<boolean> {
  const normalized = username.trim();
  if (!normalized) return false;

  const owners = exceptUserId ? identityOwnerIds(exceptUserId) : [];
  const checks: Array<Promise<boolean>> = [];
  if (isSupabaseConfigured()) {
    checks.push(isSupabaseUsernameAvailable(username, owners));
  }
  if (isFirebaseConfigured()) {
    checks.push(
      (async () => {
        const { isFirebaseUsernameAvailable } = await firebaseProfileApi();
        return isFirebaseUsernameAvailable(username, owners);
      })(),
    );
  }
  if (checks.length === 0) return true;

  try {
    const results = await Promise.all(checks);
    return results.every(Boolean);
  } catch (err) {
    console.warn('[auth] username availability check failed (blocking):', err);
    return false;
  }
}

let profileSyncQueued = false;
let pendingUser: User | null = null;
let pendingSetupFlag: boolean | undefined;

export function scheduleCloudProfileSync(
  user: User,
  options?: { profileSetupComplete?: boolean }
) {
  if (isCloudAppStateRemoteApply()) return;
  if (!isNetworkOnline()) return;
  if (!isCloudAuthConfigured() || !isCloudAuthUserId(user.id)) return;
  pendingUser = user;
  if (options?.profileSetupComplete !== undefined) {
    pendingSetupFlag = options.profileSetupComplete;
  }
  if (profileSyncQueued) return;
  profileSyncQueued = true;
  queueMicrotask(() => {
    profileSyncQueued = false;
    const target = pendingUser;
    const setup = pendingSetupFlag;
    pendingUser = null;
    pendingSetupFlag = undefined;
    if (target) void pushCloudProfile(target, { profileSetupComplete: setup });
  });
}

/** Push pending profile row immediately (call before account switch / sign-out). */
export async function flushCloudProfileSync(): Promise<void> {
  profileSyncQueued = false;
  const target = pendingUser;
  const setup = pendingSetupFlag;
  pendingUser = null;
  pendingSetupFlag = undefined;
  if (target) await pushCloudProfile(target, { profileSetupComplete: setup });
}

/** @deprecated use scheduleCloudProfileSync */
export const scheduleSupabaseProfileSync = scheduleCloudProfileSync;

function buildProfileRow(
  user: User,
  profileSetupComplete: boolean,
  changedAtMs: number,
  avatarForCloud: string | null,
): ProfileRow {
  const username = normalizeUsername(user.username || '', user.id);
  const publicUserId = resolvePublicUserId(user);
  const thought = (user.note ?? '').trim();
  return {
    id: user.id,
    username,
    display_name: user.displayName?.trim() || username,
    avatar_url: avatarForCloud || null,
    bio: user.bio ?? '',
    profile_setup_complete: profileSetupComplete,
    public_user_id: publicUserId,
    public_user_id_changed_at: new Date(changedAtMs).toISOString(),
    note: thought,
    note_updated_at: thought
      ? new Date(user.noteUpdatedAt ?? Date.now()).toISOString()
      : null,
  };
}

/**
 * Mirror the same public User ID onto the Firebase lane under the Firebase auth doc id.
 * Keeps Supabase UUID as the app-canonical id while Firebase stays a linked backup.
 */
async function mirrorProfileToFirebaseLane(canonical: ProfileRow): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const firebaseDocId = firebaseProfileDocIdForUser(canonical.id);
  if (!firebaseDocId) return;

  const { getFirebaseAuth } = await import('../firebase/app');
  const fbUid = getFirebaseAuth()?.currentUser?.uid ?? null;
  // Only write when Firebase auth can own the doc (rules: auth.uid == docId).
  if (!fbUid || fbUid !== firebaseDocId) return;

  const { upsertFirebaseProfile } = await firebaseProfileApi();
  await upsertFirebaseProfile({
    ...canonical,
    id: firebaseDocId,
    linked_supabase_user_id: isSupabaseAuthUserId(canonical.id) ? canonical.id : null,
  });
}

/**
 * Push profile to the active backend, then mirror to the other lane so
 * Supabase + Firebase stay one account / one public User ID.
 */
export async function pushCloudProfile(
  user: User,
  options?: { profileSetupComplete?: boolean }
): Promise<void> {
  if (!isCloudAuthConfigured() || !isCloudAuthUserId(user.id)) return;

  let profileSetupComplete = options?.profileSetupComplete;
  const backend = await resolveActiveProfileBackend(user.id);
  const owners = identityOwnerIds(user.id);

  if (profileSetupComplete === undefined) {
    const existing = await fetchProfileOnBackend(
      backend,
      backend === 'firebase' ? (firebaseProfileDocIdForUser(user.id) ?? user.id) : user.id,
    ).catch(() => null);
    profileSetupComplete = existing?.profile_setup_complete ?? false;
  }

  const publicUserId = resolvePublicUserId(user);
  // Preserve cooldown clock — only bump when the public User ID actually changes.
  let changedAtMs = user.publicUserIdChangedAt;
  if (changedAtMs == null || !Number.isFinite(changedAtMs)) {
    const existing = await fetchProfileOnBackend(
      backend,
      backend === 'firebase' ? (firebaseProfileDocIdForUser(user.id) ?? user.id) : user.id,
    ).catch(() => null);
    const existingPublic = existing?.public_user_id
      ? resolvePublicUserId({
          publicUserId: existing.public_user_id,
          username: existing.username,
        })
      : '';
    if (existingPublic && existingPublic === publicUserId && existing?.public_user_id_changed_at) {
      const parsed = Date.parse(existing.public_user_id_changed_at);
      changedAtMs = Number.isFinite(parsed) ? parsed : Date.now();
    } else {
      changedAtMs = Date.now();
    }
  }

  // Guard: never write a public User ID owned by a different account (either backend).
  try {
    const available = await isCloudPublicUserIdAvailable(publicUserId, user.id);
    if (!available) {
      throw new Error('User ID is taken');
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'User ID is taken') throw err;
    /* availability check optional when offline */
  }

  const { url: avatarForCloud, trimmedForSize } = await avatarUrlForCloudUpload(
    user.avatarUrl || '',
    ''
  );
  if (trimmedForSize && !avatarForCloud) {
    throw new Error(
      'Profile photo is too large to sync. Use a smaller image or paste an https:// image URL.'
    );
  }

  const canonical = buildProfileRow(
    user,
    profileSetupComplete,
    changedAtMs,
    avatarForCloud || null,
  );

  // Primary write uses the auth-owned document id for that backend.
  const primaryRow: ProfileRow =
    backend === 'firebase'
      ? {
          ...canonical,
          id: firebaseProfileDocIdForUser(user.id) ?? user.id,
          linked_supabase_user_id: isSupabaseAuthUserId(user.id) ? user.id : null,
        }
      : canonical;

  try {
    await upsertProfileOnBackend(backend, primaryRow);
    writeStoredAuthBackend(backend);

    // Dual-lane: keep the other backend aligned under the same public User ID.
    if (backend === 'supabase' && isFirebaseConfigured()) {
      await mirrorProfileToFirebaseLane(canonical).catch((err) => {
        console.warn('[auth] firebase mirror after supabase profile push failed:', err);
      });
    } else if (backend === 'firebase' && isSupabaseConfigured()) {
      if (isSupabaseAuthUserId(user.id) && (await hasSupabaseSessionForUser(user.id))) {
        await upsertProfile(canonical).catch((err) => {
          console.warn('[auth] supabase mirror after firebase profile push failed:', err);
        });
        writeStoredAuthBackend('supabase');
      } else if (
        profileSetupComplete &&
        !isSupabaseAuthUserId(user.id) &&
        !owners.some((id) => isSupabaseAuthUserId(id) && id !== user.id)
      ) {
        // Firebase-only newcomer → create/link Supabase account once.
        const { migrateFirebaseNewcomerToSupabase } = await import('./migrateFirebaseNewcomer');
        const migrated = await migrateFirebaseNewcomerToSupabase(user.id).catch(() => false);
        if (migrated) {
          const link = readFirebaseBackupLink();
          const supabaseId = link?.supabaseUserId;
          if (supabaseId) {
            await upsertProfile({ ...canonical, id: supabaseId }).catch(() => undefined);
            writeStoredAuthBackend('supabase');
          }
        }
      }
    }
  } catch (err) {
    const mapped = mapProfileSaveError(err);
    const message = mapped.message;
    if (isPermissionDeniedError(message) && backend === 'firebase') {
      if (isSupabaseConfigured() && (await hasSupabaseSessionForUser(user.id))) {
        await upsertProfile(canonical);
        writeStoredAuthBackend('supabase');
        clearSupabaseUnhealthy();
        await mirrorProfileToFirebaseLane(canonical).catch(() => undefined);
        return;
      }
      const { getFirebaseAuth } = await import('../firebase/app');
      const fbAuth = getFirebaseAuth();
      const expectedFbId = firebaseProfileDocIdForUser(user.id) ?? user.id;
      if (!fbAuth?.currentUser || fbAuth.currentUser.uid !== expectedFbId) {
        throw new Error(
          'Profile save failed: sign in again, then retry. (Cloud session did not match this profile.)',
          { cause: err }
        );
      }
      throw new Error(
        'Firebase could not save your profile. Ensure Firestore is enabled in Firebase Console, then refresh and try again.',
        { cause: err }
      );
    }
    if (
      backend === 'supabase' &&
      isFirebaseConfigured() &&
      isInfrastructureAuthFailure(message) &&
      !isPermissionDeniedError(message)
    ) {
      markSupabaseUnhealthy();
      writeStoredAuthBackend('firebase');
      const fbRow: ProfileRow = {
        ...canonical,
        id: firebaseProfileDocIdForUser(user.id) ?? user.id,
        linked_supabase_user_id: isSupabaseAuthUserId(user.id) ? user.id : null,
      };
      const { upsertFirebaseProfile } = await firebaseProfileApi();
      await upsertFirebaseProfile(fbRow);
      return;
    }
    markSupabaseCloudDegradedFromError(err);
    throw mapped;
  }
}

/** @deprecated use pushCloudProfile */
export const pushSupabaseProfile = pushCloudProfile;
