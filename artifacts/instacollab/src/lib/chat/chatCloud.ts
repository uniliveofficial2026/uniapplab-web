import { shouldUseFirebaseForCloudData } from '../auth/cloudDataBackend';
import { isFirebaseChatAvailable } from '../firebase/chatMessages';
import { isPlatformApiAvailable } from '../platformApi';
import { isSupabaseConfigured } from '../supabase/config';

/** DM/group chat cloud lane is up when any backend can carry messages. */
export function isChatCloudAvailable(): boolean {
  return isSupabaseConfigured() || isPlatformApiAvailable() || isFirebaseChatAvailable();
}

/** Prefer Firebase when Supabase is degraded or account is on Firebase backup. */
export function shouldUseFirebaseForChat(userId?: string | null): boolean {
  if (!isFirebaseChatAvailable()) return false;
  if (!isSupabaseConfigured()) return true;
  return shouldUseFirebaseForCloudData(userId);
}
