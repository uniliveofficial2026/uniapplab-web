import { shouldUseFirebaseForCloudData } from '../auth/cloudDataBackend';
import { isFirebaseConfigured } from '../firebase/config';
import { isFirebaseBlocksAvailable } from '../firebase/userBlocks';
import { isFirebaseFollowsAvailable } from '../firebase/follows';
import { isFirebaseNotificationsAvailable } from '../firebase/notifications';
import { isFirebaseProfileVisitsAvailable } from '../firebase/profileVisits';
import { isFirebaseSocialContentAvailable } from '../firebase/socialContent';
import { isFirebaseCloudPostsAvailable } from '../firebase/cloudPosts';
import { isSupabaseConfigured } from '../supabase/config';

/** Social + graph cloud lane is up when any backend can carry the data. */
export function isSocialCloudAvailable(): boolean {
  return (
    isSupabaseConfigured() ||
    isFirebaseCloudPostsAvailable() ||
    isFirebaseSocialContentAvailable() ||
    isFirebaseFollowsAvailable() ||
    isFirebaseBlocksAvailable() ||
    isFirebaseNotificationsAvailable() ||
    isFirebaseProfileVisitsAvailable()
  );
}

/** Prefer Firebase when Supabase is degraded or account is on Firebase backup. */
export function shouldUseFirebaseForSocialCloud(userId?: string | null): boolean {
  if (!isFirebaseConfigured()) return false;
  if (!isSupabaseConfigured()) return true;
  return shouldUseFirebaseForCloudData(userId);
}
