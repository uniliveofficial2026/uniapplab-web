import type {
  LiveKind,
  ProfileVisitEntry,
  ProfileVisitEvent,
  ProfileVisitSurface,
  User,
} from '../types';
import { LIVE_KIND_LABELS } from './liveRing';

export type { ProfileVisitSurface };

export interface ProfileVisitContext {
  surface: ProfileVisitSurface;
  contentId?: string;
  previewUrl?: string;
  liveKind?: LiveKind;
}

export const PROFILE_VISIT_SURFACES: ProfileVisitSurface[] = [
  'profile',
  'posts',
  'reels',
  'story',
  'live',
];

export const PROFILE_VISIT_SURFACE_LABELS: Record<ProfileVisitSurface, string> = {
  profile: 'Profile',
  posts: 'Posts',
  reels: 'Reels',
  story: 'Story',
  live: 'Live',
};

export function emptySurfaceCounts(): Record<ProfileVisitSurface, number> {
  return { profile: 0, posts: 0, reels: 0, story: 0, live: 0 };
}

export function visitContextKey(ctx: ProfileVisitContext): string {
  return [
    ctx.surface,
    ctx.contentId ?? '',
    ctx.liveKind ?? '',
  ].join('|');
}

export function buildVisitEvent(
  at: number,
  ctx: ProfileVisitContext
): ProfileVisitEvent {
  return {
    at,
    surface: ctx.surface,
    contentId: ctx.contentId,
    previewUrl: ctx.previewUrl,
    liveKind: ctx.liveKind,
  };
}

export function formatVisitSurfaceLabel(
  entry: Pick<
    ProfileVisitEntry,
    'lastSurface' | 'lastLiveKind' | 'lastContentId'
  >
): string {
  const surface = entry.lastSurface ?? 'profile';
  if (surface === 'live') {
    const kind = entry.lastLiveKind;
    return kind
      ? `Live · ${LIVE_KIND_LABELS[kind] ?? kind}`
      : 'Live';
  }
  if (surface === 'posts' && entry.lastContentId) return 'Post';
  if (surface === 'reels' && entry.lastContentId) return 'Reel';
  return PROFILE_VISIT_SURFACE_LABELS[surface];
}

export function formatVisitActionLine(
  entry: Pick<
    ProfileVisitEntry,
    'lastSurface' | 'lastLiveKind' | 'lastContentId' | 'visitCount'
  >
): string {
  const surface = entry.lastSurface ?? 'profile';
  switch (surface) {
    case 'profile':
      return 'Viewed your profile';
    case 'posts':
      return entry.lastContentId ? 'Opened a post' : 'Browsed posts';
    case 'reels':
      return entry.lastContentId ? 'Watched a reel' : 'Browsed reels';
    case 'story':
      return 'Watched your story';
    case 'live': {
      const kind = entry.lastLiveKind;
      return kind
        ? `Joined ${LIVE_KIND_LABELS[kind] ?? kind} live`
        : 'Joined your live';
    }
    default:
      return 'Visited';
  }
}

export interface ProfileVisitorAudienceSummary {
  followingYou: number;
  youFollowThem: number;
  mutual: number;
  verified: number;
  notFollowingYou: number;
}

export function summarizeVisitorAudience(
  visitors: User[],
  ownerFollowingIds: Set<string>
): ProfileVisitorAudienceSummary {
  let followingYou = 0;
  let youFollowThem = 0;
  let mutual = 0;
  let verified = 0;

  for (const user of visitors) {
    const theyFollowYou = !!user.isFollowing;
    const youFollow = ownerFollowingIds.has(user.id);
    if (theyFollowYou) followingYou += 1;
    if (youFollow) youFollowThem += 1;
    if (theyFollowYou && youFollow) mutual += 1;
    if (user.isVerified) verified += 1;
  }

  return {
    followingYou,
    youFollowThem,
    mutual,
    verified,
    notFollowingYou: Math.max(0, visitors.length - followingYou),
  };
}

export function formatAudienceInsight(
  audience: ProfileVisitorAudienceSummary,
  total: number
): string | null {
  if (total === 0) return null;
  const parts: string[] = [];
  if (audience.followingYou > 0) {
    parts.push(
      `${audience.followingYou} follow you${audience.followingYou === total ? '' : ''}`
    );
  }
  if (audience.mutual > 0 && audience.mutual !== audience.followingYou) {
    parts.push(`${audience.mutual} mutual`);
  }
  if (audience.youFollowThem > 0) {
    parts.push(`you follow ${audience.youFollowThem}`);
  }
  if (audience.verified > 0) {
    parts.push(`${audience.verified} verified`);
  }
  if (parts.length === 0) {
    return `${total} ${total === 1 ? 'account' : 'accounts'} viewed your profile`;
  }
  return parts.join(' · ');
}

export function topSurfaceFromCounts(
  counts: Record<ProfileVisitSurface, number>
): ProfileVisitSurface | null {
  let best: ProfileVisitSurface | null = null;
  let bestN = 0;
  for (const surface of PROFILE_VISIT_SURFACES) {
    const n = counts[surface] ?? 0;
    if (n > bestN) {
      bestN = n;
      best = surface;
    }
  }
  return bestN > 0 ? best : null;
}
