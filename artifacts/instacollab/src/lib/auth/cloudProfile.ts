import type { User } from '../../types';
import type { ProfileRow } from '../supabase/types';
import {
  fetchFirebaseProfile,
  isFirebasePublicUserIdAvailable,
  isFirebaseUsernameAvailable,
  upsertFirebaseProfile,
} from '../firebase/profile';
import { resolvePublicUserId } from '../publicUserId';
import { isFirebaseConfigured } from '../firebase/config';
import { getFirebaseAuth } from '../firebase/app';
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
import { clearSupabaseUnhealthy, markSupabaseUnhealthy, writeStoredAuthBackend } from './providerState';
import { isCloudAuthConfigured } from './config';

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
    await upsertFirebaseProfile(row);
    return;
  }
  await upsertProfile(row);
}

async function fetchProfileOnBackend(
  backend: 'supabase' | 'firebase',
  userId: string
): Promise<ProfileRow | null> {
  if (backend === 'firebase') return fetchFirebaseProfile(userId);
  return fetchProfile(userId);
}

export async function isCloudPublicUserIdAvailable(
  publicUserId: string,
  exceptUserId?: string
): Promise<boolean> {
  try {
    const backend =
      exceptUserId && (await hasSupabaseSessionForUser(exceptUserId))
        ? 'supabase'
        : exceptUserId && isSupabaseAuthUserId(exceptUserId)
          ? 'supabase'
          : exceptUserId
            ? await resolveActiveProfileBackend(exceptUserId)
            : isSupabaseConfigured()
              ? 'supabase'
              : 'firebase';

    if (backend === 'firebase' && isFirebaseConfigured()) {
      return await isFirebasePublicUserIdAvailable(publicUserId, exceptUserId);
    }
    if (isSupabaseConfigured()) {
      try {
        return await isSupabasePublicUserIdAvailable(publicUserId, exceptUserId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          exceptUserId &&
          isFirebaseConfigured() &&
          isInfrastructureAuthFailure(message) &&
          !isPermissionDeniedError(message)
        ) {
          markSupabaseUnhealthy();
          return await isFirebasePublicUserIdAvailable(publicUserId, exceptUserId);
        }
        throw err;
      }
    }
    if (isFirebaseConfigured()) {
      return await isFirebasePublicUserIdAvailable(publicUserId, exceptUserId);
    }
    return true;
  } catch (err) {
    console.warn('[auth] public user id availability check failed:', err);
    return true;
  }
}

export async function isCloudUsernameAvailable(
  username: string,
  exceptUserId?: string
): Promise<boolean> {
  try {
    const backend =
      exceptUserId && (await hasSupabaseSessionForUser(exceptUserId))
        ? 'supabase'
        : exceptUserId && isSupabaseAuthUserId(exceptUserId)
          ? 'supabase'
          : exceptUserId
            ? await resolveActiveProfileBackend(exceptUserId)
            : isSupabaseConfigured()
              ? 'supabase'
              : 'firebase';

    if (backend === 'firebase' && isFirebaseConfigured()) {
      return await isFirebaseUsernameAvailable(username, exceptUserId);
    }
    if (isSupabaseConfigured()) {
      try {
        return await isSupabaseUsernameAvailable(username, exceptUserId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          exceptUserId &&
          isFirebaseConfigured() &&
          isInfrastructureAuthFailure(message) &&
          !isPermissionDeniedError(message)
        ) {
          markSupabaseUnhealthy();
          return await isFirebaseUsernameAvailable(username, exceptUserId);
        }
        throw err;
      }
    }
    if (isFirebaseConfigured()) {
      return await isFirebaseUsernameAvailable(username, exceptUserId);
    }
    return true;
  } catch (err) {
    console.warn('[auth] username availability check failed:', err);
    return true;
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingUser: User | null = null;
let pendingSetupFlag: boolean | undefined;

export function scheduleCloudProfileSync(
  user: User,
  options?: { profileSetupComplete?: boolean }
) {
  if (!isCloudAuthConfigured() || !isCloudAuthUserId(user.id)) return;
  pendingUser = user;
  if (options?.profileSetupComplete !== undefined) {
    pendingSetupFlag = options.profileSetupComplete;
  }
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const target = pendingUser;
    const setup = pendingSetupFlag;
    pendingUser = null;
    pendingSetupFlag = undefined;
    if (target) void pushCloudProfile(target, { profileSetupComplete: setup });
  }, 450);
}

/** Push pending profile row immediately (call before account switch / sign-out). */
export async function flushCloudProfileSync(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  const target = pendingUser;
  const setup = pendingSetupFlag;
  pendingUser = null;
  pendingSetupFlag = undefined;
  if (target) await pushCloudProfile(target, { profileSetupComplete: setup });
}

/** @deprecated use scheduleCloudProfileSync */
export const scheduleSupabaseProfileSync = scheduleCloudProfileSync;

export async function pushCloudProfile(
  user: User,
  options?: { profileSetupComplete?: boolean }
): Promise<void> {
  if (!isCloudAuthConfigured() || !isCloudAuthUserId(user.id)) return;

  let profileSetupComplete = options?.profileSetupComplete;
  const backend = await resolveActiveProfileBackend(user.id);

  if (profileSetupComplete === undefined) {
    const existing = await fetchProfileOnBackend(backend, user.id).catch(() => null);
    profileSetupComplete = existing?.profile_setup_complete ?? false;
  }

  const username = normalizeUsername(user.username || '', user.id);
  const publicUserId = resolvePublicUserId(user);
  const changedAtMs = user.publicUserIdChangedAt ?? Date.now();
  const { url: avatarForCloud, trimmedForSize } = await avatarUrlForCloudUpload(
    user.avatarUrl || '',
    ''
  );
  if (trimmedForSize && !avatarForCloud) {
    throw new Error(
      'Profile photo is too large to sync. Use a smaller image or paste an https:// image URL.'
    );
  }
  const row: ProfileRow = {
    id: user.id,
    username,
    display_name: user.displayName?.trim() || username,
    avatar_url: avatarForCloud || null,
    bio: user.bio ?? '',
    profile_setup_complete: profileSetupComplete,
    public_user_id: publicUserId,
    public_user_id_changed_at: new Date(changedAtMs).toISOString(),
  };

  try {
    await upsertProfileOnBackend(backend, row);
    writeStoredAuthBackend(backend);
  } catch (err) {
    const mapped = mapProfileSaveError(err);
    const message = mapped.message;
    if (isPermissionDeniedError(message) && backend === 'firebase') {
      if (isSupabaseConfigured() && (await hasSupabaseSessionForUser(user.id))) {
        await upsertProfile(row);
        writeStoredAuthBackend('supabase');
        clearSupabaseUnhealthy();
        return;
      }
      const fbAuth = getFirebaseAuth();
      if (!fbAuth?.currentUser || fbAuth.currentUser.uid !== user.id) {
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
      await upsertFirebaseProfile(row);
      return;
    }
    throw mapped;
  }
}

/** @deprecated use pushCloudProfile */
export const pushSupabaseProfile = pushCloudProfile;
