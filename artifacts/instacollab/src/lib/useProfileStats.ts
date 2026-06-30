import { useMemo } from 'react';
import type { Post, User } from '../types';
import type { CreatorProgress } from './creatorXP';
import { postUserId, resolveUser, safeUserId } from './safe';
import { useDB, useDbRevision } from './useDB';

export type ProfileStats = {
  profileUser: User;
  userPosts: Post[];
  followerCount: number;
  followingCount: number;
  creatorProgress: CreatorProgress;
};

/** Canonical profile counters — posts from feed store, social counts from follow graph. */
export function useProfileStats(
  user: Partial<User> | null | undefined,
  userId?: string | null
): ProfileStats {
  const db = useDB();
  const revision = useDbRevision();
  const resolvedId = safeUserId(user?.id ?? userId);

  const profileUser = useMemo(() => {
    const id = resolvedId;
    const row = id ? db.users.find((u) => u?.id === id) : undefined;
    return resolveUser(
      db.users,
      user ?? row ?? (id ? { id } : null),
      db.currentUser
    );
  }, [
    resolvedId,
    revision,
    db.users,
    db.currentUser?.id,
    user?.username,
    user?.displayName,
    user?.avatarUrl,
    user?.bio,
    user?.isVerified,
    user?.followers,
    user?.following,
  ]);

  const profileUserId = profileUser.id;

  const userPosts = useMemo(
    () =>
      (db.posts ?? []).filter(
        (p) => postUserId(p) === profileUserId && !p.isArchived
      ),
    [db.posts, profileUserId]
  );

  const followerCount = db.getFollowListMembers(profileUserId, 'followers').length;
  const followingCount = db.getFollowListMembers(profileUserId, 'following').length;

  const creatorProgress = useMemo(
    () => db.getCreatorProgress(profileUserId),
    [db, profileUserId, db.posts, db.reels, db.users, followerCount]
  );

  return {
    profileUser,
    userPosts,
    followerCount,
    followingCount,
    creatorProgress,
  };
}
