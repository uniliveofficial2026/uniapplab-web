/**
 * Silent cloud data routing — users never see provider switches.
 * When Supabase is degraded, Firebase handles the same payloads (profiles, user_app_state, etc.).
 *
 * Intentionally Firebase-SDK-free at module load so Shell/Feed boot does not parse vendor-firebase.
 */
import { isFirebaseConfigured } from '../firebase/config';
import { isSupabaseConfigured } from '../supabase/config';
import { hasSupabaseSessionForUser } from './activeBackend';
import { isInfrastructureAuthFailure } from './failover';
import { isSupabaseOAuthDegraded, markSupabaseOAuthDegraded } from './providerState';

/**
 * Instant — use for hot paths (no network).
 * Does NOT force Firebase merely because a Firebase↔Supabase link exists.
 * Linked accounts still prefer Supabase whenever a session is available.
 */
export function shouldUseFirebaseForCloudData(_userId?: string | null): boolean {
  if (!isFirebaseConfigured()) return false;
  if (!isSupabaseConfigured()) return true;
  if (isSupabaseOAuthDegraded()) return true;
  return false;
}

/** Pick read/write backend for cloud data (profiles, user_app_state, …). */
export async function resolveCloudDataBackend(userId: string): Promise<'supabase' | 'firebase'> {
  if (shouldUseFirebaseForCloudData(userId) && isFirebaseConfigured()) {
    return 'firebase';
  }
  if (isSupabaseConfigured() && (await hasSupabaseSessionForUser(userId))) {
    return 'supabase';
  }
  if (isFirebaseConfigured()) return 'firebase';
  if (isSupabaseConfigured()) return 'supabase';
  return 'firebase';
}

/** On Supabase infra errors, flip to Firebase silently for the rest of the session. */
export function markSupabaseCloudDegradedFromError(err: unknown): void {
  if (!isFirebaseConfigured()) return;
  const message = err instanceof Error ? err.message : String(err);
  if (isInfrastructureAuthFailure(message)) {
    markSupabaseOAuthDegraded();
  }
}

export async function withCloudDataFailover<T>(
  userId: string,
  runSupabase: () => Promise<T>,
  runFirebase: () => Promise<T>,
): Promise<T> {
  if (shouldUseFirebaseForCloudData(userId) && isFirebaseConfigured()) {
    try {
      return await runFirebase();
    } catch (err) {
      markSupabaseCloudDegradedFromError(err);
      throw err;
    }
  }
  if (!isSupabaseConfigured()) {
    return runFirebase();
  }
  try {
    return await runSupabase();
  } catch (err) {
    markSupabaseCloudDegradedFromError(err);
    if (isFirebaseConfigured()) {
      return runFirebase();
    }
    throw err;
  }
}
