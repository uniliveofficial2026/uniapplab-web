/**
 * Unified posts/reels cloud API — routes to Firebase when Supabase is unreachable.
 */
import type { Post } from '../../types';
import { isFirebaseConfigured } from '../firebase/config';
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

async function firebaseCloudPosts() {
  return import('../firebase/cloudPosts');
}

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
  if (shouldUseFirebaseForSocialCloud(userId) && isFirebaseConfigured()) {
    const fb = await firebaseCloudPosts();
    if (fb.isFirebaseCloudPostsAvailable()) {
      return fb.uploadFirebasePostMediaBlob(userId, postId, kind, blob, fileName);
    }
  }
  try {
    return await uploadSupabasePostMediaBlob(userId, postId, kind, blob, fileName);
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseCloudPosts();
      if (fb.isFirebaseCloudPostsAvailable()) {
        return fb.uploadFirebasePostMediaBlob(userId, postId, kind, blob, fileName);
      }
    }
    return null;
  }
}

export async function upsertCloudPost(post: Post, authorId?: string): Promise<boolean> {
  const userId = authorId ?? post.user?.id ?? '';
  if (shouldUseFirebaseForSocialCloud(userId) && isFirebaseConfigured()) {
    const fb = await firebaseCloudPosts();
    if (fb.isFirebaseCloudPostsAvailable()) {
      return fb.upsertFirebaseCloudPost(post);
    }
  }
  try {
    return await upsertSupabaseCloudPost(post);
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseCloudPosts();
      if (fb.isFirebaseCloudPostsAvailable()) return fb.upsertFirebaseCloudPost(post);
    }
    return false;
  }
}

export async function deleteCloudPost(postId: string, userId?: string): Promise<boolean> {
  if (!postId || !userId) return false;
  if (shouldUseFirebaseForSocialCloud(userId) && isFirebaseConfigured()) {
    const fb = await firebaseCloudPosts();
    if (fb.isFirebaseCloudPostsAvailable()) {
      return fb.deleteFirebaseCloudPost(postId, userId);
    }
  }
  try {
    return await deleteSupabaseCloudPost(postId, userId);
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseCloudPosts();
      if (fb.isFirebaseCloudPostsAvailable()) return fb.deleteFirebaseCloudPost(postId, userId);
    }
    return false;
  }
}

export async function fetchCloudFeedPosts(limit = 60, userId?: string): Promise<Post[]> {
  if (shouldUseFirebaseForSocialCloud(userId) && isFirebaseConfigured()) {
    const fb = await firebaseCloudPosts();
    if (fb.isFirebaseCloudPostsAvailable()) {
      return fb.fetchFirebaseCloudFeedPosts(limit);
    }
  }
  try {
    return await fetchSupabaseCloudFeedPosts(limit);
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseCloudPosts();
      if (fb.isFirebaseCloudPostsAvailable()) return fb.fetchFirebaseCloudFeedPosts(limit);
    }
    return [];
  }
}

export async function fetchCloudUserPosts(authorId: string, limit = 60): Promise<Post[]> {
  if (shouldUseFirebaseForSocialCloud(authorId) && isFirebaseConfigured()) {
    const fb = await firebaseCloudPosts();
    if (fb.isFirebaseCloudPostsAvailable()) {
      return fb.fetchFirebaseCloudUserPosts(authorId, limit);
    }
  }
  try {
    return await fetchSupabaseCloudUserPosts(authorId, limit);
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseCloudPosts();
      if (fb.isFirebaseCloudPostsAvailable()) return fb.fetchFirebaseCloudUserPosts(authorId, limit);
    }
    return [];
  }
}

export function subscribeCloudPosts(onChange: () => void, userId?: string): () => void {
  if (shouldUseFirebaseForSocialCloud(userId) && isFirebaseConfigured()) {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    void firebaseCloudPosts().then((fb) => {
      if (cancelled || !fb.isFirebaseCloudPostsAvailable()) return;
      unsub = fb.subscribeFirebaseCloudPosts(onChange);
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }
  return subscribeSupabaseCloudPosts(onChange);
}
