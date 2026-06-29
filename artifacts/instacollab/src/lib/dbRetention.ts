export type RetentionKind =
  | 'posts'
  | 'reels'
  | 'messages'
  | 'stories'
  | 'profile_stories'
  | 'audit'
  | 'reel_comments'
  | 'post_comments'
  | 'replies';

export type StorageTier = '50GB' | '100GB' | 'Unlimited';

export function shouldSkipAutoRetention(
  hasUnlimitedPlan: boolean,
  offlineSync: boolean
): boolean {
  if (hasUnlimitedPlan) return true;
  return offlineSync;
}

export function retentionLimit(
  kind: RetentionKind,
  tier: StorageTier,
  offlineSync: boolean,
  hasUnlimitedPlan: boolean
): number {
  if (hasUnlimitedPlan) return 1_000_000;

  const scale = offlineSync ? 2 : 1;
  const base: Record<RetentionKind, number> = {
    posts: tier === '100GB' ? 2000 : 400,
    reels: tier === '100GB' ? 1500 : 300,
    messages: tier === '100GB' ? 2500 : 500,
    stories: tier === '100GB' ? 500 : 100,
    profile_stories: tier === '100GB' ? 5000 : 1000,
    audit: tier === '100GB' ? 1000 : 200,
    reel_comments: tier === '100GB' ? 2000 : 400,
    post_comments: tier === '100GB' ? 2000 : 400,
    replies: tier === '100GB' ? 1000 : 200,
  };
  return Math.floor(base[kind] * scale);
}

export function limitNewest<T>(items: T[], limit: number): T[] {
  if (!Array.isArray(items)) return [];
  if (items.length <= limit) return items;
  return items.slice(0, limit);
}
