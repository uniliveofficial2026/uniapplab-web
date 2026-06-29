import { isFirebaseConfigured } from '../firebase/config';
import { isSupabaseConfigured } from '../supabase/config';

/**
 * Cloud auth + realtime sync when Supabase is configured (primary).
 * Firebase-only remains for legacy envs without Supabase.
 */
export function isCloudAuthConfigured(): boolean {
  return isSupabaseConfigured() || isFirebaseConfigured();
}

/** True when Supabase should own auth, profiles, and user_app_state realtime. */
export function isPrimarySupabaseCloud(): boolean {
  return isSupabaseConfigured();
}

export { isSupabaseConfigured } from '../supabase/config';
export { isFirebaseConfigured } from '../firebase/config';
