/** Gift showcase tiers driven by coin (stars) value. */

export type GiftEffectTier = 'normal' | 'premium' | 'epic' | 'legendary' | 'mythic';

/** Legacy catalog / studio values still accepted when reading stored gifts. */
export type LegacyGiftEffectTier = 'combo' | 'standard' | 'fullscreen';

export type AnyGiftEffectTier = GiftEffectTier | LegacyGiftEffectTier | (string & {});

export type GiftTierMeta = {
  id: GiftEffectTier;
  label: string;
  /** Inclusive min coin value. */
  minStars: number;
  /** Inclusive max coin value (null = no upper bound). */
  maxStars: number | null;
  animation: string;
  badgeClass: string;
};

export const GIFT_TIER_META: readonly GiftTierMeta[] = [
  {
    id: 'normal',
    label: 'Normal',
    minStars: 1,
    maxStars: 99,
    animation: 'Small icon animation',
    badgeClass: 'bg-slate-500/25 text-slate-200 border-slate-400/30',
  },
  {
    id: 'premium',
    label: 'Premium',
    minStars: 100,
    maxStars: 999,
    animation: 'Medium SVGA effect',
    badgeClass: 'bg-sky-500/25 text-sky-200 border-sky-400/35',
  },
  {
    id: 'epic',
    label: 'Epic',
    minStars: 1_000,
    maxStars: 9_999,
    animation: 'Full-screen SVGA',
    badgeClass: 'bg-violet-500/25 text-violet-200 border-violet-400/35',
  },
  {
    id: 'legendary',
    label: 'Legendary',
    minStars: 10_000,
    maxStars: 99_999,
    animation: 'Cinematic animation',
    badgeClass: 'bg-amber-500/25 text-amber-200 border-amber-400/40',
  },
  {
    id: 'mythic',
    label: 'Mythic',
    minStars: 100_000,
    maxStars: null,
    animation: 'Multi-stage event with global announcement',
    badgeClass: 'bg-fuchsia-500/30 text-fuchsia-100 border-fuchsia-300/45',
  },
] as const;

export const GIFT_TIER_OPTIONS: GiftEffectTier[] = GIFT_TIER_META.map((row) => row.id);

export function giftTierFromStars(stars: number): GiftEffectTier {
  const value = Math.max(0, Math.floor(Number(stars) || 0));
  if (value >= 100_000) return 'mythic';
  if (value >= 10_000) return 'legendary';
  if (value >= 1_000) return 'epic';
  if (value >= 100) return 'premium';
  return 'normal';
}

export function giftTierMeta(tier: GiftEffectTier): GiftTierMeta {
  return GIFT_TIER_META.find((row) => row.id === tier) ?? GIFT_TIER_META[0];
}

/** Prefer coin value; fall back to stored/legacy tier labels. */
export function normalizeGiftTier(
  tier: AnyGiftEffectTier | undefined | null,
  stars?: number,
): GiftEffectTier {
  if (typeof stars === 'number' && Number.isFinite(stars) && stars > 0) {
    return giftTierFromStars(stars);
  }
  switch (String(tier || '').toLowerCase()) {
    case 'normal':
      return 'normal';
    case 'premium':
      return 'premium';
    case 'epic':
      return 'epic';
    case 'legendary':
      return 'legendary';
    case 'mythic':
      return 'mythic';
    case 'combo':
      return 'normal';
    case 'standard':
      return 'premium';
    case 'fullscreen':
      return 'epic';
    default:
      return 'normal';
  }
}

export function giftEffectDurationMs(tier: GiftEffectTier): number {
  switch (tier) {
    case 'normal':
      return 2400;
    case 'premium':
      return 3200;
    case 'epic':
      return 4200;
    case 'legendary':
      return 5600;
    case 'mythic':
      return 7800;
    default:
      return 3200;
  }
}
