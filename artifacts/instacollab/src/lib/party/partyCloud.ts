import { shouldUseFirebaseForCloudData } from '../auth/cloudDataBackend';
import { isFirebaseConfigured } from '../firebase/config';
import { isSupabaseConfigured } from '../supabase/config';

/** Party room cloud sync is available when either backend is configured. */
export function isPartyCloudAvailable(): boolean {
  return isFirebaseConfigured() || isSupabaseConfigured();
}

/** Prefer Firebase for party reads/writes (Supabase unreachable or Firebase-only account). */
export function shouldUseFirebaseForPartyCloud(userId?: string | null): boolean {
  if (!isFirebaseConfigured()) return false;
  if (!isSupabaseConfigured()) return true;
  return shouldUseFirebaseForCloudData(userId);
}
