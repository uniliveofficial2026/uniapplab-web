/**
 * Unified posts/reels cloud API — routes to Firebase when Supabase is unreachable.
 */
import type { Post } from '../../types';
import {
  deleteFirebaseCloudPost,
  fetchFirebaseCloudFeedPosts,
  fetchFirebaseCloudUserPosts,
  isFirebaseCloudPostsAvailable,
  subscribeFirebaseCloudPosts,
  uploadFirebasePostMediaBlob,
  upsertFirebaseCloudPost,
} from '../firebase/cloudPosts';
import {
  deleteCloudPost as deleteSupabaseCloudPost,
  fetchCloudFeedPosts as fetchSupabaseCloudFeedPosts,
  fetchCloudUserPosts as fetchSupabaseCloudUserPosts,
  subscribeCloudPosts as subscribeSupabaseCloudPosts,
  uploadPostMediaBlob as uploadSupabasePostMediaBlob,
  upsertCloudPost as upsertSupabaseCloudPost,
} from '../supabase/cloudPosts';
import { isSocialCloudAvailable, shouldUseFirebaseForSocialCloud } from '../social/socialCloud';

export { type CloudPostRow, cloudRowToPost } from '../supabase/cloudPosts';

export function isPostsCloudAvailable(): boolean {
  return isSocialCloudAvailable();
}

export async function uploadPostMediaBlob(
  userId: string,
  postId: string,
  kind: 'image' | 'video' | 'audio' | 'cover',
  blob: Blob,
  fileName: string,
): Promise<string | null> {
  if (shouldUseFirebaseForSocialCloud(userId) && isFirebaseCloudPostsAvailable()) {
    return uploadFirebasePostMediaBlob(userId, postId, kind, blob, fileName);
  }
  try {
    return await uploadSupabasePostMediaBlob(userId, postId, kind, blob, fileName);
  } catch {
    if (isFirebaseCloudPostsAvailable()) {
      return uploadFirebasePostMediaBlob(userId, postId, kind, blob, fileName);
    }
    return null;
  }
}

export async function upsertCloudPost(post: Post, authorId?: string): Promise<boolean> {
  const userId = authorId ?? post.user?.id ?? '';
  if (shouldUseFirebaseForSocialCloud(userId) && isFirebaseCloudPostsAvailable()) {
    return upsertFirebaseCloudPost(post);
  }
  try {
    return await upsertSupabaseCloudPost(post);
  } catch {
    if (isFirebaseCloudPostsAvailable()) return upsertFirebaseCloudPost(post);
    return false;
  }
}

export async function deleteCloudPost(postId: string, userId?: string): Promise<boolean> {
  if (shouldUseFirebaseForSocialCloud(userId) && isFirebaseCloudPostsAvailable()) {
    return deleteFirebaseCloudPost(postId);
  }
  try {
    return await deleteSupabaseCloudPost(postId);
  } catch {
    if (isFirebaseCloudPostsAvailable()) return deleteFirebaseCloudPost(postId);
    return false;
  }
}

export async function fetchCloudFeedPosts(limit = 60, userId?: string): Promise<Post[]> {
  if (shouldUseFirebaseForSocialCloud(userId) && isFirebaseCloudPostsAvailable()) {
    return fetchFirebaseCloudFeedPosts(limit);
  }
  try {
    return await fetchSupabaseCloudFeedPosts(limit);
  } catch {
    if (isFirebaseCloudPostsAvailable()) return fetchFirebaseCloudFeedPosts(limit);
    return [];
  }
}

export async function fetchCloudUserPosts(authorId: string, limit = 60): Promise<Post[]> {
  if (shouldUseFirebaseForSocialCloud(authorId) && isFirebaseCloudPostsAvailable()) {
    return fetchFirebaseCloudUserPosts(authorId, limit);
  }
  try {
    return await fetchSupabaseCloudUserPosts(authorId, limit);
  } catch {
    if (isFirebaseCloudPostsAvailable()) return fetchFirebaseCloudUserPosts(authorId, limit);
    return [];
  }
}

export function subscribeCloudPosts(onChange: () => void, userId?: string): () => void {
  if (shouldUseFirebaseForSocialCloud(userId) && isFirebaseCloudPostsAvailable()) {
    return subscribeFirebaseCloudPosts(onChange);
  }
  const unsub = subscribeSupabaseCloudPosts(onChange);
  if (isFirebaseCloudPostsAvailable()) {
    const unsubFb = subscribeFirebaseCloudPosts(onChange);
    return () => {
      unsub();
      unsubFb();
    };
  }
  return unsub;
}
