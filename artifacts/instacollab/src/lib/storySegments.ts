import type { StoryDraftMedia } from '../components/stories/storyDraft';
import type { LiveKind, User } from '../types';
import { resolveLiveKind } from './liveRing';
import { safeUserId, safeArray, resolveUser } from './safe';

/** Home feed story ring TTL — profile archive is not subject to this window. */
export const FEED_STORY_TTL_MS = 24 * 60 * 60 * 1000;

export function hasMultipleStories(segmentCount: number): boolean {
  return segmentCount > 1;
}

export function segmentCreatedAtMs(segment: StoryDraftMedia): number {
  const raw = segment.createdAt;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function isFeedActiveStorySegment(
  segment: StoryDraftMedia,
  now = Date.now(),
): boolean {
  const created = segmentCreatedAtMs(segment);
  if (!created) return true;
  return now - created < FEED_STORY_TTL_MS;
}

export function groupStorySegmentsByDay(
  segments: StoryDraftMedia[],
): StoryDraftMedia[][] {
  const buckets = new Map<string, StoryDraftMedia[]>();
  for (const segment of segments) {
    const ms = segmentCreatedAtMs(segment) || Date.now();
    const dayKey = new Date(ms).toISOString().slice(0, 10);
    const list = buckets.get(dayKey) ?? [];
    list.push(segment);
    buckets.set(dayKey, list);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, daySegments]) =>
      [...daySegments].sort(
        (a, b) => segmentCreatedAtMs(a) - segmentCreatedAtMs(b),
      ),
    );
}

export function formatStoryDayLabel(ms: number, now = Date.now()): string {
  const date = new Date(ms);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayMs = dayStart.getTime();
  const todayMs = todayStart.getTime();
  if (dayMs === todayMs) return 'Today';
  if (dayMs === todayMs - 86_400_000) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export type ProfileStoryDayEntry = {
  id: string;
  dayKey: string;
  user: User;
  segments: StoryDraftMedia[];
  hasViewed: boolean;
  label: string;
};

export function buildProfileStoryDayEntries(
  user: User,
  segments: StoryDraftMedia[],
  hasViewedProfileDay: (userId: string, dayKey: string) => boolean,
): ProfileStoryDayEntry[] {
  return groupStorySegmentsByDay(segments).map((daySegments) => {
    const ms = segmentCreatedAtMs(daySegments[0]) || Date.now();
    const dayKey = new Date(ms).toISOString().slice(0, 10);
    return {
      id: `profile-story-${user.id}-${dayKey}`,
      dayKey,
      user,
      segments: daySegments,
      hasViewed: hasViewedProfileDay(user.id, dayKey),
      label: formatStoryDayLabel(ms),
    };
  });
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
    segmentCountOverride?: number;
  },
): StoryRingVisualState {
  const segmentCount =
    options.segmentCountOverride ??
    options.getUserStorySegments(userId).length;
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

function countActiveFeedSegments(segments: unknown[]): number {
  return safeArray(segments).filter((segment) =>
    isFeedActiveStorySegment(segment as StoryDraftMedia),
  ).length;
}

/** Users who should appear in the feed story strip (excluding current user). Feed = 24h window only. */
export function buildFeedStoryEntries(
  posts: Array<{ user?: User } | null | undefined>,
  users: Array<User | null | undefined>,
  storiesByUser: Record<string, unknown[]>,
  hasViewedStory: (userId: string) => boolean,
  currentUserId: string,
): Array<{ id: string; user: User; hasViewed: boolean }> {
  const seen = new Set<string>([currentUserId]);
  const entries: Array<{ id: string; user: User; hasViewed: boolean }> = [];

  const addUser = (user: User | Partial<User> | undefined) => {
    const id = safeUserId(user?.id);
    if (!id || seen.has(id)) return;
    const merged = resolveUser(users, user);
    const segmentCount = countActiveFeedSegments(storiesByUser[id] ?? []);
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
      if (!Array.isArray(segments) || countActiveFeedSegments(segments) === 0) return;
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
