/** UniLive’s centralized production asset system — shared types. */

export const UNILIVES_BRAND_NAME = "UniLive’s" as const;
export type UniLivesBrandName = typeof UNILIVES_BRAND_NAME;

export type AssetFormat =
  | 'png'
  | 'webp'
  | 'jpg'
  | 'svg'
  | 'svga'
  | 'webm'
  | 'mp4'
  | 'json'
  | 'audio';

export type AssetStatus = 'production' | 'placeholder' | 'missing' | 'deprecated';

export type AssetCategory =
  | 'brand'
  | 'onboarding'
  | 'auth'
  | 'profile-setup'
  | 'discovery'
  | 'gift'
  | 'sticker'
  | 'seat-interaction'
  | 'badge'
  | 'avatar-ring'
  | 'frame'
  | 'live-room'
  | 'wallet'
  | 'sharing'
  | 'legal'
  | 'ui';

export interface UniLivesAsset {
  id: string;
  brand: UniLivesBrandName;
  name: string;
  category: AssetCategory;
  status: AssetStatus;
  version: number;
  formats: Partial<Record<AssetFormat, string>>;
  thumbnail?: string;
  fallback?: string;
  reducedMotionFallback?: string;
  lowPerformanceFallback?: string;
  audio?: string;
  durationMs?: number;
  loop?: boolean;
  fullScreen?: boolean;
  priority?: number;
  width?: number;
  height?: number;
  tags?: string[];
  /** Legacy business IDs this visual replaces (do not rename business IDs). */
  replacementFor?: string[];
}

export interface AssetManifestFile {
  version: number;
  category: AssetCategory | 'index';
  brand: UniLivesBrandName;
  assets: UniLivesAsset[];
}

export type ReplacementMappingStatus =
  | 'pending'
  | 'validated'
  | 'active'
  | 'rolled-back'
  | 'wired-with-production-asset'
  | 'wired-with-fallback'
  | 'blocked-missing-asset'
  | 'not-in-phase'
  | 'unmapped'
  | 'duplicate-review'
  | 'legacy-active-fallback';

export interface AssetReplacementMapping {
  existingId: string;
  newAssetId: string;
  type: AssetCategory | string;
  preserveBusinessId: boolean;
  status: ReplacementMappingStatus;
  existingReferences?: string[];
  newFilePaths?: string[];
  fallback?: string;
  validationStatus?: string;
  rollbackPath?: string;
  /** Phase 7 gift mapping metadata (visual-only; does not alter payloads). */
  notes?: string;
  visualTier?: string;
  businessTier?: string;
  price?: number;
  currency?: string;
  legacyThumbnail?: string;
  legacyAnimation?: string;
  /** Phase 8 seat-interaction metadata (visual-only). */
  category?: string;
  sourceTargetMode?: string;
  permissionScope?: string;
  cooldownReference?: string;
}

export interface ReplacementMapFile {
  version: number;
  mappings: AssetReplacementMapping[];
}

export interface AssetValidationIssue {
  code:
    | 'duplicate_id'
    | 'missing_file'
    | 'invalid_brand'
    | 'orphan_file'
    | 'broken_replacement'
    | 'empty_formats';
  message: string;
  assetId?: string;
  path?: string;
}

export interface AssetValidationReport {
  ok: boolean;
  checkedAt: string;
  totalAssets: number;
  productionCount: number;
  placeholderCount: number;
  missingCount: number;
  deprecatedCount: number;
  duplicateIds: string[];
  orphanPaths: string[];
  existingLegacyAssetsFound: number;
  issues: AssetValidationIssue[];
}

export interface ResolvedAssetUrl {
  assetId: string;
  url: string;
  format: AssetFormat | 'fallback';
  usedFallback: boolean;
  status: AssetStatus;
}

export interface AssetResolveOptions {
  preferredFormat?: AssetFormat;
  prefersReducedMotion?: boolean;
  lowPerformance?: boolean;
  animationMuted?: boolean;
  soundDisabled?: boolean;
}
