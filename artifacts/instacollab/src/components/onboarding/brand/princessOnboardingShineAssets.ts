/**
 * Locked UniLive’s princess onboarding “Shine Your Way” (slide 3) artwork.
 * Do not replace without an approved reference update.
 */
export const PRINCESS_ONBOARDING_SHINE_LOCKED_SRC =
  '/unilives-assets/onboarding/shine/princess-onboarding-shine-locked.jpg';

export const PRINCESS_ONBOARDING_SHINE_BG_EXTEND_SRC =
  '/unilives-assets/onboarding/shine/princess-onboarding-shine-bg-extend.svg';

/** Design frames requested for production readiness. */
export const PRINCESS_ONBOARDING_SHINE_FRAMES = [
  { w: 375, h: 812, label: 'mobile-375' },
  { w: 430, h: 932, label: 'mobile-430' },
  { w: 768, h: 1024, label: 'tablet-768' },
  { w: 1440, h: 900, label: 'desktop-1440' },
] as const;

/** Artwork intrinsic size (approved reference). */
export const PRINCESS_ONBOARDING_SHINE_ART_SIZE = { w: 576, h: 1024 } as const;
