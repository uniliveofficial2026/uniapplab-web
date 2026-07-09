import {
  deleteFirebaseFollow,
  deleteFirebaseFollowRequest,
  fetchFirebaseFollowerIds,
  fetchFirebaseFollowingIds,
  fetchFirebasePendingFollowRequesterIds,
  hasFirebaseFollowRequest,
  insertFirebaseFollow,
  insertFirebaseFollowRequest,
  isFirebaseFollowsAvailable,
} from '../firebase/follows';
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

export function isFollowsCloudAvailable(): boolean {
  return isSocialCloudAvailable();
}

export async function fetchFollowingIds(userId: string): Promise<string[]> {
  if (shouldUseFirebaseForSocialCloud(userId) && isFirebaseFollowsAvailable()) {
    return fetchFirebaseFollowingIds(userId);
  }
  try {
    return await fetchSupabaseFollowingIds(userId);
  } catch {
    if (isFirebaseFollowsAvailable()) return fetchFirebaseFollowingIds(userId);
    return [];
  }
}

export async function fetchFollowerIds(userId: string): Promise<string[]> {
  if (shouldUseFirebaseForSocialCloud(userId) && isFirebaseFollowsAvailable()) {
    return fetchFirebaseFollowerIds(userId);
  }
  try {
    return await fetchSupabaseFollowerIds(userId);
  } catch {
    if (isFirebaseFollowsAvailable()) return fetchFirebaseFollowerIds(userId);
    return [];
  }
}

export async function insertFollow(followerId: string, followingId: string): Promise<void> {
  if (shouldUseFirebaseForSocialCloud(followerId) && isFirebaseFollowsAvailable()) {
    return insertFirebaseFollow(followerId, followingId);
  }
  try {
    return await insertSupabaseFollow(followerId, followingId);
  } catch {
    if (isFirebaseFollowsAvailable()) return insertFirebaseFollow(followerId, followingId);
    throw new Error('Follow insert failed');
  }
}

export async function deleteFollow(followerId: string, followingId: string): Promise<void> {
  if (shouldUseFirebaseForSocialCloud(followerId) && isFirebaseFollowsAvailable()) {
    return deleteFirebaseFollow(followerId, followingId);
  }
  try {
    return await deleteSupabaseFollow(followerId, followingId);
  } catch {
    if (isFirebaseFollowsAvailable()) return deleteFirebaseFollow(followerId, followingId);
    throw new Error('Follow delete failed');
  }
}

export async function insertFollowRequest(ownerId: string, requesterId: string): Promise<void> {
  if (shouldUseFirebaseForSocialCloud(requesterId) && isFirebaseFollowsAvailable()) {
    return insertFirebaseFollowRequest(ownerId, requesterId);
  }
  try {
    return await insertSupabaseFollowRequest(ownerId, requesterId);
  } catch {
    if (isFirebaseFollowsAvailable()) return insertFirebaseFollowRequest(ownerId, requesterId);
    throw new Error('Follow request insert failed');
  }
}

export async function deleteFollowRequest(ownerId: string, requesterId: string): Promise<void> {
  if (shouldUseFirebaseForSocialCloud(requesterId) && isFirebaseFollowsAvailable()) {
    return deleteFirebaseFollowRequest(ownerId, requesterId);
  }
  try {
    return await deleteSupabaseFollowRequest(ownerId, requesterId);
  } catch {
    if (isFirebaseFollowsAvailable()) return deleteFirebaseFollowRequest(ownerId, requesterId);
    throw new Error('Follow request delete failed');
  }
}

export async function fetchPendingFollowRequesterIds(ownerId: string): Promise<string[]> {
  if (shouldUseFirebaseForSocialCloud(ownerId) && isFirebaseFollowsAvailable()) {
    return fetchFirebasePendingFollowRequesterIds(ownerId);
  }
  try {
    return await fetchSupabasePendingFollowRequesterIds(ownerId);
  } catch {
    if (isFirebaseFollowsAvailable()) return fetchFirebasePendingFollowRequesterIds(ownerId);
    return [];
  }
}

export async function hasFollowRequest(ownerId: string, requesterId: string): Promise<boolean> {
  if (shouldUseFirebaseForSocialCloud(requesterId) && isFirebaseFollowsAvailable()) {
    return hasFirebaseFollowRequest(ownerId, requesterId);
  }
  try {
    return await hasSupabaseFollowRequest(ownerId, requesterId);
  } catch {
    if (isFirebaseFollowsAvailable()) return hasFirebaseFollowRequest(ownerId, requesterId);
    return false;
  }
}
