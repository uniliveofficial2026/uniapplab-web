/**
 * Locked UniLive’s princess onboarding “Connect Together” (slide 2) artwork.
 * Do not replace without an approved reference update.
 */
export const PRINCESS_ONBOARDING_CONNECT_LOCKED_SRC =
  '/unilives-assets/onboarding/connect/princess-onboarding-connect-locked.jpg';

export const PRINCESS_ONBOARDING_CONNECT_BG_EXTEND_SRC =
  '/unilives-assets/onboarding/connect/princess-onboarding-connect-bg-extend.svg';

/** Design frames requested for production readiness. */
export const PRINCESS_ONBOARDING_CONNECT_FRAMES = [
  { w: 375, h: 812, label: 'mobile-375' },
  { w: 430, h: 932, label: 'mobile-430' },
  { w: 768, h: 1024, label: 'tablet-768' },
  { w: 1440, h: 900, label: 'desktop-1440' },
] as const;

/** Artwork intrinsic size (approved reference). */
export const PRINCESS_ONBOARDING_CONNECT_ART_SIZE = { w: 576, h: 1024 } as const;
