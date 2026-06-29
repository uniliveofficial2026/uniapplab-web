import type { LiveKind, User } from '../types';
import { resolveLiveKind } from './liveRing';
import { safeUserId, safeArray, resolveUser } from './safe';

export function hasMultipleStories(segmentCount: number): boolean {
  return segmentCount > 1;
}

export type StoryRingVisualState = {
  segmentCount: number;
  isMultiStory: boolean;
  hasStoryContent: boolean;
  isViewed: boolean;
  isLive: boolean;
  liveKind?: LiveKind;
};

export function getStoryRingVisualState(
  userId: string,
  options: {
    getUserStorySegments: (id: string) => unknown[];
    hasViewedStory: (id: string) => boolean;
    userStatus?: User['status'];
    liveKind?: User['liveKind'];
  }
): StoryRingVisualState {
  const segmentCount = options.getUserStorySegments(userId).length;
  const isLive = options.userStatus === 'live';
  const liveKind = resolveLiveKind(options.userStatus, options.liveKind);
  const hasStoryContent = isLive || segmentCount > 0;

  return {
    segmentCount,
    isMultiStory: segmentCount > 1,
    hasStoryContent,
    isViewed: options.hasViewedStory(userId),
    isLive,
    liveKind,
  };
}

/** Users who should appear in the feed story strip (excluding current user). */
export function buildFeedStoryEntries(
  posts: Array<{ user?: User } | null | undefined>,
  users: Array<User | null | undefined>,
  storiesByUser: Record<string, unknown[]>,
  hasViewedStory: (userId: string) => boolean,
  currentUserId: string
): Array<{ id: string; user: User; hasViewed: boolean }> {
  const seen = new Set<string>([currentUserId]);
  const entries: Array<{ id: string; user: User; hasViewed: boolean }> = [];

  const addUser = (user: User | Partial<User> | undefined) => {
    const id = safeUserId(user?.id);
    if (!id || seen.has(id)) return;
    const merged = resolveUser(users, user);
    const segmentCount = safeArray(storiesByUser[id]).length;
    const isLive = merged.status === 'live';
    if (segmentCount === 0 && !isLive) return;

    seen.add(id);
    entries.push({
      id: `story-${id}`,
      user: merged,
      hasViewed: hasViewedStory(id),
    });
  };

  if (storiesByUser && typeof storiesByUser === 'object') {
    Object.keys(storiesByUser).forEach((userId) => {
      if (seen.has(userId)) return;
      const segments = storiesByUser[userId];
      if (!Array.isArray(segments) || segments.length === 0) return;
      const user =
        safeArray<User>(users).find((u) => u?.id === userId) ||
        safeArray<{ user?: User }>(posts).find((p) => p?.user?.id === userId)?.user;
      addUser(user);
    });
  }

  safeArray<{ user?: User }>(posts).forEach((p) => addUser(p?.user));

  safeArray<User>(users).forEach((u) => {
    if (u?.status === 'live') addUser(u);
  });

  return entries.sort((a, b) => Number(a.hasViewed) - Number(b.hasViewed));
}
