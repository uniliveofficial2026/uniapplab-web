import { isCloudAuthUserId } from '../auth/cloudProfile';
import {
  deleteFollow,
  deleteFollowRequest,
  fetchFollowerIds,
  fetchFollowingIds,
  fetchPendingFollowRequesterIds,
  hasFollowRequest,
  insertFollow,
  insertFollowRequest,
  isFollowsCloudAvailable,
} from './followsCloud';
import { insertUserNotification } from './notificationsCloud';

type Cache = {
  followingByUser: Map<string, string[]>;
  followersByUser: Map<string, string[]>;
  pendingByOwner: Map<string, string[]>;
};

const cache: Cache = {
  followingByUser: new Map(),
  followersByUser: new Map(),
  pendingByOwner: new Map(),
};

export function isCloudFollowsEnabled(): boolean {
  return isFollowsCloudAvailable();
}

export function clearCloudFollowCache(): void {
  cache.followingByUser.clear();
  cache.followersByUser.clear();
  cache.pendingByOwner.clear();
}

export async function hydrateCloudFollowsForUser(userId: string): Promise<void> {
  if (!isCloudFollowsEnabled() || !isCloudAuthUserId(userId)) return;
  try {
    const [following, followers, pending] = await Promise.all([
      fetchFollowingIds(userId),
      fetchFollowerIds(userId),
      fetchPendingFollowRequesterIds(userId),
    ]);
    cache.followingByUser.set(userId, following);
    cache.followersByUser.set(userId, followers);
    cache.pendingByOwner.set(userId, pending);
    window.dispatchEvent(new CustomEvent('cloud-follows-updated', { detail: { userId } }));
  } catch (err) {
    console.warn('[cloud-follows] hydrate failed:', err);
  }
}

export async function refreshCloudFollowsForProfile(profileUserId: string): Promise<void> {
  if (!isCloudFollowsEnabled() || !profileUserId) return;
  try {
    const [following, followers] = await Promise.all([
      fetchFollowingIds(profileUserId),
      fetchFollowerIds(profileUserId),
    ]);
    cache.followingByUser.set(profileUserId, following);
    cache.followersByUser.set(profileUserId, followers);
    window.dispatchEvent(
      new CustomEvent('cloud-follows-updated', { detail: { userId: profileUserId } }),
    );
  } catch (err) {
    console.warn('[cloud-follows] profile refresh failed:', err);
  }
}

export function getCachedFollowingIds(userId: string): string[] | null {
  return cache.followingByUser.get(userId) ?? null;
}

export function getCachedFollowerIds(userId: string): string[] | null {
  return cache.followersByUser.get(userId) ?? null;
}

export function getCachedPendingRequesterIds(ownerId: string): string[] | null {
  return cache.pendingByOwner.get(ownerId) ?? null;
}

function bumpCacheList(
  map: Map<string, string[]>,
  userId: string,
  mutate: (list: string[]) => string[],
): void {
  const current = map.get(userId) ?? [];
  map.set(userId, mutate([...current]));
}

export async function cloudFollowToggle(
  meId: string,
  targetUserId: string,
  nextFollowing: boolean,
): Promise<void> {
  if (!isCloudFollowsEnabled() || !isCloudAuthUserId(meId)) return;

  if (nextFollowing) {
    await insertFollow(meId, targetUserId);
    bumpCacheList(cache.followingByUser, meId, (list) =>
      list.includes(targetUserId) ? list : [...list, targetUserId],
    );
    bumpCacheList(cache.followersByUser, targetUserId, (list) =>
      list.includes(meId) ? list : [...list, meId],
    );
    void insertUserNotification({
      userId: targetUserId,
      type: 'follow',
      actorId: meId,
    });
  } else {
    await deleteFollow(meId, targetUserId);
    bumpCacheList(cache.followingByUser, meId, (list) => list.filter((id) => id !== targetUserId));
    bumpCacheList(cache.followersByUser, targetUserId, (list) => list.filter((id) => id !== meId));
    await deleteFollowRequest(targetUserId, meId).catch(() => undefined);
  }

  window.dispatchEvent(new CustomEvent('cloud-follows-updated', { detail: { userId: meId } }));
}

export async function cloudFollowRequestToggle(
  meId: string,
  ownerId: string,
  add: boolean,
): Promise<void> {
  if (!isCloudFollowsEnabled() || !isCloudAuthUserId(meId)) return;

  if (add) {
    await insertFollowRequest(ownerId, meId);
    bumpCacheList(cache.pendingByOwner, ownerId, (list) =>
      list.includes(meId) ? list : [...list, meId],
    );
    void insertUserNotification({
      userId: ownerId,
      type: 'follow_request',
      actorId: meId,
    });
  } else {
    await deleteFollowRequest(ownerId, meId);
    bumpCacheList(cache.pendingByOwner, ownerId, (list) => list.filter((id) => id !== meId));
  }

  window.dispatchEvent(new CustomEvent('cloud-follows-updated', { detail: { userId: meId } }));
}

export async function cloudApproveFollowRequest(
  ownerId: string,
  requesterId: string,
): Promise<void> {
  if (!isCloudFollowsEnabled() || !isCloudAuthUserId(ownerId)) return;
  await deleteFollowRequest(ownerId, requesterId);
  await insertFollow(requesterId, ownerId);
  bumpCacheList(cache.pendingByOwner, ownerId, (list) =>
    list.filter((id) => id !== requesterId),
  );
  bumpCacheList(cache.followingByUser, requesterId, (list) =>
    list.includes(ownerId) ? list : [...list, ownerId],
  );
  bumpCacheList(cache.followersByUser, ownerId, (list) =>
    list.includes(requesterId) ? list : [...list, requesterId],
  );
  void insertUserNotification({
    userId: requesterId,
    type: 'follow',
    actorId: ownerId,
    body: 'accepted your follow request.',
  });
  window.dispatchEvent(new CustomEvent('cloud-follows-updated', { detail: { userId: ownerId } }));
}

export async function cloudRejectFollowRequest(ownerId: string, requesterId: string): Promise<void> {
  if (!isCloudFollowsEnabled() || !isCloudAuthUserId(ownerId)) return;
  await deleteFollowRequest(ownerId, requesterId);
  bumpCacheList(cache.pendingByOwner, ownerId, (list) =>
    list.filter((id) => id !== requesterId),
  );
}

export async function cloudHasFollowRequest(ownerId: string, requesterId: string): Promise<boolean> {
  if (!isCloudFollowsEnabled()) return false;
  const cached = cache.pendingByOwner.get(ownerId);
  if (cached) return cached.includes(requesterId);
  try {
    return await hasFollowRequest(ownerId, requesterId);
  } catch {
    return false;
  }
}

/** Merge cloud following into local follow_graph for the active user. */
export function mergeCloudFollowingIntoLocalGraph(
  meId: string,
  localGraph: { following: Record<string, string[]> },
): { following: Record<string, string[]> } {
  const cloud = getCachedFollowingIds(meId);
  if (!cloud) return localGraph;
  return {
    following: {
      ...localGraph.following,
      [meId]: cloud,
    },
  };
}
