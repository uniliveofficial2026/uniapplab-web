/** TRTC/TUILiveKit-style gift effect tiers: combo barrage, path fly-in, full-screen SVGA. */
export type GiftEffectTier = 'combo' | 'standard' | 'fullscreen';

export type GiftEffectDefinition = {
  id: string;
  name: string;
  icon: string;
  stars: number;
  tier: GiftEffectTier;
  /** TRTC basic player — SVGA (preferred for standard/fullscreen). */
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
