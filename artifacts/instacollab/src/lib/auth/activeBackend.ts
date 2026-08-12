import { isFirebaseConfigured } from '../firebase/config';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/config';
import { shouldUseFirebaseForCloudData } from './cloudDataBackend';
import { readFirebaseBackupLink } from './firebaseBackupLink';

const SUPABASE_USER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function readFirebaseUid(): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;
  const { getFirebaseAuth } = await import('../firebase/app');
  return getFirebaseAuth()?.currentUser?.uid ?? null;
}

/** True when Supabase Auth has a session for this user (refresh-safe). */
export async function hasSupabaseSessionForUser(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (!sessionError && sessionData.session?.user?.id === userId) return true;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (!userError && userData.user?.id === userId) return true;

  return false;
}

async function refreshSupabaseSessionIfNeeded(userId: string): Promise<boolean> {
  if (await hasSupabaseSessionForUser(userId)) return true;
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  const { data, error } = await supabase.auth.refreshSession();
  if (error) return false;
  return data.session?.user?.id === userId;
}

/** Pick profile read/write backend from live sessions — never stale localStorage failover. */
export async function resolveActiveProfileBackend(
  userId: string
): Promise<'supabase' | 'firebase'> {
  // Prefer live Supabase session even when a Firebase backup link exists.
  if (await hasSupabaseSessionForUser(userId)) return 'supabase';

  if (shouldUseFirebaseForCloudData(userId) && isFirebaseConfigured()) {
    return 'firebase';
  }

  const fbUid = await readFirebaseUid();
  if (fbUid === userId) return 'firebase';

  if (SUPABASE_USER_ID.test(userId)) {
    if (isSupabaseConfigured()) {
      if (await refreshSupabaseSessionIfNeeded(userId)) return 'supabase';
      // Linked Firebase OAuth can keep the same account online without a Supabase session.
      const link = readFirebaseBackupLink();
      if (
        isFirebaseConfigured() &&
        link?.supabaseUserId === userId &&
        fbUid &&
        fbUid === link.firebaseUid
      ) {
        return 'firebase';
      }
      if (shouldUseFirebaseForCloudData(userId) && isFirebaseConfigured()) {
        return 'firebase';
      }
      throw new Error('Your session expired. Log out and sign in again, then retry profile setup.');
    }
    throw new Error('Supabase is not configured for this account.');
  }

  if (isFirebaseConfigured() && fbUid) {
    return 'firebase';
  }

  if (isSupabaseConfigured()) return 'supabase';
  if (isFirebaseConfigured()) return 'firebase';

  throw new Error('No cloud auth session found. Log in again.');
}

export function isPermissionDeniedError(message: string): boolean {
  return /permission|insufficient permissions|permission-denied/i.test(message);
}

export function isSupabaseAuthUserId(userId: string): boolean {
  return SUPABASE_USER_ID.test(userId);
}
