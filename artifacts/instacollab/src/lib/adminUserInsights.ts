import type { CreatorProgress } from './creatorXP';
import type { LaunchProgress } from './dbTypes';
import type { LocalDB } from './db/localDbType';
import { getKstarCoinsFromStore, isKstarVip } from './kstarUserState';
import { postUserId, reelUserId } from './safe';
import type { User } from '../types';

export type AdminUserInsights = {
  userId: string;
  user: User | undefined;
  followerCount: number;
  followingCount: number;
  likesReceived: number;
  commentLikesGiven: number;
  postCount: number;
  reelCount: number;
  commentsWritten: number;
  savesOnPosts: number;
  creatorProgress: CreatorProgress;
  launchProgress: LaunchProgress;
  kstarCoins: number;
  kstarVip: boolean;
};

export function buildAdminUserInsights(db: LocalDB, userId: string): AdminUserInsights {
  const id = String(userId || '').trim();
  const user = (db.users ?? []).find((row) => row?.id === id);
  const creatorProgress = db.getCreatorProgress(id);
  const followerCount = db.getFollowListMembers(id, 'followers').length;
  const followingCount = db.getFollowListMembers(id, 'following').length;

  let commentsWritten = 0;
  let commentLikesGiven = 0;
  for (const list of Object.values(db.postComments ?? {})) {
    for (const comment of list ?? []) {
      if (!comment) continue;
      const authorId = String((comment as { userId?: string; authorId?: string }).userId ?? (comment as { authorId?: string }).authorId ?? '');
      if (authorId === id) commentsWritten += 1;
      if ((comment as { likedBy?: string[] }).likedBy?.includes(id)) commentLikesGiven += 1;
    }
  }
  for (const list of Object.values(db.reelComments ?? {})) {
    for (const comment of list ?? []) {
      if (!comment) continue;
      const authorId = String((comment as { userId?: string; authorId?: string }).userId ?? (comment as { authorId?: string }).authorId ?? '');
      if (authorId === id) commentsWritten += 1;
      if ((comment as { likedBy?: string[] }).likedBy?.includes(id)) commentLikesGiven += 1;
    }
  }

  let savesOnPosts = 0;
  for (const post of db.posts ?? []) {
    if (postUserId(post) === id && post.isSaved) savesOnPosts += 1;
  }
  for (const reel of db.reels ?? []) {
    if (reelUserId(reel) === id && reel.isSaved) savesOnPosts += 1;
  }

  return {
    userId: id,
    user,
    followerCount,
    followingCount,
    likesReceived: creatorProgress.activity.likesReceived,
    commentLikesGiven,
    postCount: creatorProgress.activity.postCount,
    reelCount: creatorProgress.activity.reelCount,
    commentsWritten,
    savesOnPosts,
    creatorProgress,
    launchProgress: db.getLaunchProgress(),
    kstarCoins: getKstarCoinsFromStore(id),
    kstarVip: isKstarVip(user ?? null),
  };
}
