import type { ProfileVisitSurface } from '../types';

/** XP weights — tuned so active demo profiles land in mid-tier Creator range. */
export const CREATOR_XP_WEIGHTS = {
  base: 120,
  post: 420,
  reel: 520,
  likeReceived: 2,
  follower: 7,
  storySegment: 38,
  profileVisit: 14,
  premiumBonus: 800,
} as const;

export type CreatorActivityStats = {
  postCount: number;
  reelCount: number;
  likesReceived: number;
  followers: number;
  storySegmentCount: number;
  profileVisitCount: number;
  hasActivePremium: boolean;
};

export type CreatorProgress = {
  xp: number;
  level: number;
  tierLabel: string;
  xpIntoLevel: number;
  xpToNextLevel: number;
  progressPercent: number;
  activity: CreatorActivityStats;
};

export function totalXpToReachLevel(level: number): number {
  const lv = Math.max(1, Math.floor(level));
  return 25 * lv * lv;
}

export function levelFromTotalXp(xp: number): number {
  const safe = Math.max(0, Math.floor(xp));
  return Math.max(1, Math.floor(Math.sqrt(safe / 25)));
}

export function tierLabelForLevel(level: number): string {
  if (level >= 50) return 'Legend';
  if (level >= 40) return 'Elite';
  if (level >= 30) return 'Pro';
  if (level >= 20) return 'Creator';
  if (level >= 10) return 'Rising';
  if (level >= 5) return 'Builder';
  return 'Rookie';
}

export function computeXpFromActivity(stats: CreatorActivityStats): number {
  const w = CREATOR_XP_WEIGHTS;
  let xp = w.base;
  xp += stats.postCount * w.post;
  xp += stats.reelCount * w.reel;
  xp += stats.likesReceived * w.likeReceived;
  xp += stats.followers * w.follower;
  xp += stats.storySegmentCount * w.storySegment;
  xp += stats.profileVisitCount * w.profileVisit;
  if (stats.hasActivePremium) xp += w.premiumBonus;
  return Math.max(0, Math.floor(xp));
}

export function buildCreatorProgress(stats: CreatorActivityStats): CreatorProgress {
  const xp = computeXpFromActivity(stats);
  const level = levelFromTotalXp(xp);
  const xpAtLevel = totalXpToReachLevel(level);
  const xpAtNext = totalXpToReachLevel(level + 1);
  const xpIntoLevel = Math.max(0, xp - xpAtLevel);
  const xpToNextLevel = Math.max(1, xpAtNext - xpAtLevel);
  const progressPercent = Math.min(
    100,
    Math.round((xpIntoLevel / xpToNextLevel) * 100)
  );

  return {
    xp,
    level,
    tierLabel: tierLabelForLevel(level),
    xpIntoLevel,
    xpToNextLevel,
    progressPercent,
    activity: stats,
  };
}

/** Surfaces that count toward “content” XP breakdown labels (UI only). */
export const CREATOR_SURFACE_XP_HINT: Record<ProfileVisitSurface, string> = {
  profile: 'Profile views',
  posts: 'Post engagement',
  reels: 'Reel engagement',
  story: 'Story views',
  live: 'Live views',
};
