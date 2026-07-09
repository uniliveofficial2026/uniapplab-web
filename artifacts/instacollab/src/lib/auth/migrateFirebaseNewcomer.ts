/**
 * Silent migration for users created on Firebase while Supabase was down.
 */
import { db } from '../db/localDb';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/config';
import { getFirebaseAuth } from '../firebase/app';
import { fetchFirebaseProfile } from '../firebase/profile';
import { fetchFirebaseUserAppState } from '../firebase/userAppState';
import { upsertSupabaseUserAppState } from '../supabase/userAppState';
import { applySupabaseSessionToLocalDb } from './sessionManager';
import { saveFirebaseBackupLink } from './firebaseBackupLink';
import { writeStoredAuthBackend } from './providerState';
import { restartCloudAppStateSync } from './cloudAppState';
import { withTimeout } from '../supabase/withTimeout';

const MIGRATE_MS = 12_000;

async function mergeFirebaseAppStateByUid(
  firebaseUid: string,
  supabaseUserId: string,
): Promise<void> {
  const firebasePayload = await fetchFirebaseUserAppState(firebaseUid).catch(() => null);
  if (!firebasePayload) return;
  try {
    await upsertSupabaseUserAppState(supabaseUserId, firebasePayload);
  } catch (err) {
    console.warn('[auth] newcomer app_state merge failed:', err);
  }
}

/** Create/link Supabase account for a Firebase-only newcomer — no UI. */
export async function migrateFirebaseNewcomerToSupabase(firebaseUid: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const fbUser = getFirebaseAuth()?.currentUser;
  if (!fbUser || fbUser.uid !== firebaseUid) return false;

  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const profile = await fetchFirebaseProfile(firebaseUid).catch(() => null);
  const idToken = await fbUser.getIdToken().catch(() => null);
  if (!idToken) return false;

  const origin =
    typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : '';
  const res = await withTimeout(
    fetch(`${origin}/api/auth/migrate-firebase`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        firebaseUid,
        username: profile?.username,
        displayName: profile?.display_name,
        profileSetupComplete: profile?.profile_setup_complete,
        avatarUrl: profile?.avatar_url,
      }),
    }),
    MIGRATE_MS,
    'migrate-firebase',
  ).catch(() => null);

  if (!res?.ok) return false;

  const body = (await res.json().catch(() => null)) as {
    supabaseUserId?: string;
    access_token?: string;
    refresh_token?: string;
  } | null;

  if (!body?.supabaseUserId || !body.access_token || !body.refresh_token) return false;

  const { data: sessionData, error: sessionError } = await withTimeout(
    supabase.auth.setSession({
      access_token: body.access_token,
      refresh_token: body.refresh_token,
    }),
    MIGRATE_MS,
    'Supabase setSession',
  ).catch(() => ({ data: { session: null }, error: new Error('setSession failed') }));

  if (sessionError || !sessionData.session?.user) return false;

  saveFirebaseBackupLink({
    firebaseUid,
    supabaseUserId: body.supabaseUserId,
    email: fbUser.email || '',
  });

  await mergeFirebaseAppStateByUid(firebaseUid, body.supabaseUserId);

  const silent = db.isLoggedIn;
  await applySupabaseSessionToLocalDb(sessionData.session, { silent });
  writeStoredAuthBackend('supabase');
  await restartCloudAppStateSync(body.supabaseUserId);

  if (import.meta.env.DEV) {
    console.info('[auth] silent newcomer migration complete', body.supabaseUserId.slice(0, 8));
  }
  return true;
}
