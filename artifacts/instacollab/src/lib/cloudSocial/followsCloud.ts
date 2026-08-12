import { isFirebaseConfigured } from '../firebase/config';
import {
  deleteFollow as deleteSupabaseFollow,
  deleteFollowRequest as deleteSupabaseFollowRequest,
  fetchFollowerIds as fetchSupabaseFollowerIds,
  fetchFollowingIds as fetchSupabaseFollowingIds,
  fetchPendingFollowRequesterIds as fetchSupabasePendingFollowRequesterIds,
  hasFollowRequest as hasSupabaseFollowRequest,
  insertFollow as insertSupabaseFollow,
  insertFollowRequest as insertSupabaseFollowRequest,
} from '../supabase/follows';
import { isSocialCloudAvailable, shouldUseFirebaseForSocialCloud } from '../social/socialCloud';

async function firebaseFollows() {
  return import('../firebase/follows');
}

export function isFollowsCloudAvailable(): boolean {
  return isSocialCloudAvailable();
}

export async function fetchFollowingIds(userId: string): Promise<string[]> {
  if (shouldUseFirebaseForSocialCloud(userId) && isFirebaseConfigured()) {
    const fb = await firebaseFollows();
    if (fb.isFirebaseFollowsAvailable()) {
      return fb.fetchFirebaseFollowingIds(userId);
    }
  }
  try {
    return await fetchSupabaseFollowingIds(userId);
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseFollows();
      if (fb.isFirebaseFollowsAvailable()) return fb.fetchFirebaseFollowingIds(userId);
    }
    return [];
  }
}

export async function fetchFollowerIds(userId: string): Promise<string[]> {
  if (shouldUseFirebaseForSocialCloud(userId) && isFirebaseConfigured()) {
    const fb = await firebaseFollows();
    if (fb.isFirebaseFollowsAvailable()) {
      return fb.fetchFirebaseFollowerIds(userId);
    }
  }
  try {
    return await fetchSupabaseFollowerIds(userId);
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseFollows();
      if (fb.isFirebaseFollowsAvailable()) return fb.fetchFirebaseFollowerIds(userId);
    }
    return [];
  }
}

export async function insertFollow(followerId: string, followingId: string): Promise<void> {
  if (shouldUseFirebaseForSocialCloud(followerId) && isFirebaseConfigured()) {
    const fb = await firebaseFollows();
    if (fb.isFirebaseFollowsAvailable()) {
      return fb.insertFirebaseFollow(followerId, followingId);
    }
  }
  try {
    return await insertSupabaseFollow(followerId, followingId);
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseFollows();
      if (fb.isFirebaseFollowsAvailable()) return fb.insertFirebaseFollow(followerId, followingId);
    }
    throw new Error('Follow insert failed');
  }
}

export async function deleteFollow(followerId: string, followingId: string): Promise<void> {
  if (shouldUseFirebaseForSocialCloud(followerId) && isFirebaseConfigured()) {
    const fb = await firebaseFollows();
    if (fb.isFirebaseFollowsAvailable()) {
      return fb.deleteFirebaseFollow(followerId, followingId);
    }
  }
  try {
    return await deleteSupabaseFollow(followerId, followingId);
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseFollows();
      if (fb.isFirebaseFollowsAvailable()) return fb.deleteFirebaseFollow(followerId, followingId);
    }
    throw new Error('Follow delete failed');
  }
}

export async function insertFollowRequest(ownerId: string, requesterId: string): Promise<void> {
  if (shouldUseFirebaseForSocialCloud(requesterId) && isFirebaseConfigured()) {
    const fb = await firebaseFollows();
    if (fb.isFirebaseFollowsAvailable()) {
      return fb.insertFirebaseFollowRequest(ownerId, requesterId);
    }
  }
  try {
    return await insertSupabaseFollowRequest(ownerId, requesterId);
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseFollows();
      if (fb.isFirebaseFollowsAvailable()) return fb.insertFirebaseFollowRequest(ownerId, requesterId);
    }
    throw new Error('Follow request insert failed');
  }
}

export async function deleteFollowRequest(ownerId: string, requesterId: string): Promise<void> {
  if (shouldUseFirebaseForSocialCloud(requesterId) && isFirebaseConfigured()) {
    const fb = await firebaseFollows();
    if (fb.isFirebaseFollowsAvailable()) {
      return fb.deleteFirebaseFollowRequest(ownerId, requesterId);
    }
  }
  try {
    return await deleteSupabaseFollowRequest(ownerId, requesterId);
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseFollows();
      if (fb.isFirebaseFollowsAvailable()) return fb.deleteFirebaseFollowRequest(ownerId, requesterId);
    }
    throw new Error('Follow request delete failed');
  }
}

export async function fetchPendingFollowRequesterIds(ownerId: string): Promise<string[]> {
  if (shouldUseFirebaseForSocialCloud(ownerId) && isFirebaseConfigured()) {
    const fb = await firebaseFollows();
    if (fb.isFirebaseFollowsAvailable()) {
      return fb.fetchFirebasePendingFollowRequesterIds(ownerId);
    }
  }
  try {
    return await fetchSupabasePendingFollowRequesterIds(ownerId);
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseFollows();
      if (fb.isFirebaseFollowsAvailable()) return fb.fetchFirebasePendingFollowRequesterIds(ownerId);
    }
    return [];
  }
}

export async function hasFollowRequest(ownerId: string, requesterId: string): Promise<boolean> {
  if (shouldUseFirebaseForSocialCloud(requesterId) && isFirebaseConfigured()) {
    const fb = await firebaseFollows();
    if (fb.isFirebaseFollowsAvailable()) {
      return fb.hasFirebaseFollowRequest(ownerId, requesterId);
    }
  }
  try {
    return await hasSupabaseFollowRequest(ownerId, requesterId);
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseFollows();
      if (fb.isFirebaseFollowsAvailable()) return fb.hasFirebaseFollowRequest(ownerId, requesterId);
    }
    return false;
  }
}
