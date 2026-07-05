import { getSupabaseClient } from '../supabase/client';
import { getFirebaseCurrentUser } from '../firebase/authApi';
import { migrateFirebaseNewcomerToSupabase } from './migrateFirebaseNewcomer';

let migrateInflight: Promise<string | null> | null = null;

async function readSupabaseSessionUserId(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * Canonical Supabase auth user id for RLS writes (party chat, cloud DMs).
 * Falls back to Firebase → silent Supabase link when needed.
 */
export async function resolveSupabaseSessionUserId(
  fallbackUserId?: string | null,
  options?: { attemptMigrate?: boolean },
): Promise<string | null> {
  const sessionUserId = await readSupabaseSessionUserId();
  if (sessionUserId) return sessionUserId;

  if (!options?.attemptMigrate) {
    const trimmed = fallbackUserId?.trim();
    return trimmed || null;
  }

  const fbUid = getFirebaseCurrentUser()?.uid ?? fallbackUserId?.trim();
  if (!fbUid) return null;

  if (!migrateInflight) {
    migrateInflight = migrateFirebaseNewcomerToSupabase(fbUid)
      .then(() => readSupabaseSessionUserId())
      .finally(() => {
        migrateInflight = null;
      });
  }

  const linked = await migrateInflight;
  return linked ?? fbUid;
}
