/** TRTC/TUILiveKit-style gift effect tiers driven by coin value. */
export type {
  GiftEffectTier,
  LegacyGiftEffectTier,
  AnyGiftEffectTier,
  GiftTierMeta,
} from './giftTiers';
export {
  GIFT_TIER_META,
  GIFT_TIER_OPTIONS,
  giftTierFromStars,
  giftTierMeta,
  normalizeGiftTier,
  giftEffectDurationMs,
} from './giftTiers';

import type { GiftEffectTier } from './giftTiers';

export type GiftEffectDefinition = {
  id: string;
  name: string;
  icon: string;
  stars: number;
  tier: GiftEffectTier;
  /** TRTC basic player — SVGA (preferred for premium+). */
  effectSvgaUrl?: string;
  /** Gift AR / full-screen transparent MP4/WebM. */
  effectVideoUrl?: string;
  particleColor?: string;
};

export type PublishedGiftItem = GiftEffectDefinition & {
  status: 'draft' | 'published';
  updatedAt: number;
};

export type BeautyProvider = 'trtc' | 'deepar' | 'css' | (string & {});

export type PublishedBeautyItem = {
  id: string;
  name: string;
  provider: BeautyProvider;
  category: string;
  previewUrl?: string;
  assetUrl?: string;
  paramsJson?: string;
  status: 'draft' | 'published';
  updatedAt: number;
};
