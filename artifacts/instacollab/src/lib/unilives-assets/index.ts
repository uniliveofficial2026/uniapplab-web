/**
 * UniLive’s centralized production asset system.
 *
 * Screens and reusable UI must resolve assets through this API:
 *   resolveAsset("badge.vip.default").formats
 *   getAssetUrl("gift.legendary.phoenix")
 *
 * Do not hardcode `/unilives-assets/...` paths in components.
 */

export type {
  AssetCategory,
  AssetFormat,
  AssetManifestFile,
  AssetReplacementMapping,
  AssetResolveOptions,
  AssetStatus,
  AssetValidationIssue,
  AssetValidationReport,
  ReplacementMapFile,
  ReplacementMappingStatus,
  ResolvedAssetUrl,
  UniLivesAsset,
  UniLivesBrandName,
} from './types';
export { UNILIVES_BRAND_NAME } from './types';

export {
  detectPrefersReducedMotion,
  getAssetFeatureFlags,
  resetAssetFeatureFlags,
  setAssetFeatureFlags,
} from './featureFlags';
export type { UniLivesAssetFeatureFlags } from './featureFlags';

export {
  CATEGORY_FALLBACK_PATHS,
  LEGACY_PUBLIC_ASSETS,
  categoryFallbackPath,
  resolveConfiguredFallback,
} from './fallbacks';

export {
  PUBLIC_MANIFEST_PATHS,
  getDuplicateAssetIds,
  getRegisteredAsset,
  getRegistryVersion,
  getReplacementMap,
  hasRegisteredAsset,
  listRegisteredAssets,
  listReplacementMappings,
  registerManifestAssets,
  resolveBusinessIdToAssetId,
} from './registry';

export {
  getAssetAudioUrl,
  getAssetFallback,
  getAssetUrl,
  isKnownAssetId,
  resolveAsset,
  resolveAssetUrlDetailed,
  shouldPlayAssetAudio,
} from './resolver';

export {
  listLegacyPublicAssets,
  listMissingAssets,
  validateAssetRegistry,
} from './validation';

export {
  clearPreloadCache,
  isAssetPreloaded,
  preloadAsset,
  preloadAssets,
} from './preload';

export {
  UNILIVES_KNOWN_GOOD_BRAND_FALLBACK,
  brandAnimationModeForContext,
  brandAssetIdForContext,
  brandAssetIdForVariant,
  resolveBrandContextUrl,
  resolveBrandRegistryUrl,
  resolveBrandVariantUrl,
  shouldUseAnimatedBrand,
} from './brandResolve';
export type {
  BrandAnimationMode,
  BrandMarkVariant,
  BrandVisualContext,
} from './brandResolve';

export {
  GIFT_MYTHIC_UNIVERSE_RESERVED_ID,
  LEGACY_GIFT_SVGA_BY_BUSINESS_ID,
  UNILIVES_NEUTRAL_GIFT_FALLBACK,
  getGiftReplacementMapping,
  resolveGiftCanonicalAssetId,
  resolveGiftPlayMedia,
  resolveGiftThumbnailVisual,
  resolveLegacyGiftAnimationUrl,
} from './giftResolve';
export type {
  GiftPlayMedia,
  GiftResolvedVisual,
  GiftVisualContext,
} from './giftResolve';

export {
  EDITOR_STICKER_CATALOG,
  UNILIVES_NEUTRAL_STICKER_FALLBACK,
  editorStickerAssetId,
  editorStickerEmojiFromId,
  editorStickerIdFromEmoji,
  getStickerReplacementMapping,
  resolveStickerCanonicalAssetId,
  resolveStickerPlayMedia,
  resolveStickerThumbnailVisual,
} from './stickerResolve';
export type {
  EditorStickerId,
  StickerPlayMedia,
  StickerResolvedVisual,
} from './stickerResolve';

export {
  SEAT_INTERACTION_CATALOG,
  UNILIVES_NEUTRAL_INTERACTION_FALLBACK,
  getSeatInteractionReplacementMapping,
  resolveSeatInteractionCanonicalAssetId,
  resolveSeatInteractionPlayMedia,
  resolveSeatInteractionThumbnailVisual,
} from './seatInteractionResolve';
export type {
  InteractionResolvedVisual,
  SeatInteractionBusinessId,
  SeatInteractionPlayMedia,
} from './seatInteractionResolve';

export {
  UNILIVES_NEUTRAL_IDENTITY_FALLBACK,
  levelDisplayBucket,
  resolveFrameAssetIdFromLegacyStyle,
  resolveIdentityMediaUrl,
  resolveLevelBadgeAssetId,
  resolveRoleBadgeAssetId,
  resolveStatusRingAssetId,
  resolveVerificationBadgeAssetId,
  resolveVipBadgeAssetId,
  resolveVipRingAssetId,
} from './identityResolve';
export type {
  IdentityMediaVisual,
  RoomRoleDisplay,
  VipDisplayTier,
} from './identityResolve';

export {
  UNILIVES_NEUTRAL_LEGAL_FALLBACK,
  resolveLegalCanonicalAssetId,
  resolveLegalMediaUrl,
} from './legalResolve';
export type { LegalMediaVisual, LegalVisualKind } from './legalResolve';

export {
  UNILIVES_NEUTRAL_SHARING_FALLBACK,
  resolveShareCardBackgroundAssetId,
  resolveSharingCanonicalAssetId,
  resolveSharingMediaUrl,
} from './sharingResolve';
export type { SharingMediaVisual, SharingVisualKind } from './sharingResolve';

export {
  CHARACTER_MASCOT_AUDIO_ID,
  CHARACTER_MASCOT_PREVIEW_ID,
  resolveCharacterPreviewAudioUrl,
  resolveCharacterPreviewModelUrl,
  resolveCharacterSafeFallbackUrl,
} from './characterResolve';
