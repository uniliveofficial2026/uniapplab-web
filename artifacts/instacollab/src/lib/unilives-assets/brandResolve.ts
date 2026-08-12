/**
 * UniLive’s brand visual resolution (Phase 1).
 *
 * Precedence for runtime logo URL:
 * 1. Valid admin / platform_app_brand remote (or local data/blob upload)
 * 2. Canonical registry asset when status is production|placeholder
 * 3. Existing /brand/app-logo.png
 *
 * Missing production files never invent binaries — they resolve to the known-good fallback.
 */

import {
  detectPrefersReducedMotion,
  getAssetFeatureFlags,
} from './featureFlags';
import { getAssetUrl, resolveAsset } from './resolver';
import type { AssetResolveOptions } from './types';

export type BrandVisualContext =
  | 'splash'
  | 'loading'
  | 'header'
  | 'profile'
  | 'share'
  | 'legal'
  | 'favicon'
  | 'notification'
  | 'pwa';

export type BrandMarkVariant = 'full' | 'compact' | 'icon' | 'horizontal' | 'monochrome';

const VARIANT_TO_ASSET_ID: Record<BrandMarkVariant, string> = {
  full: 'brand.logo.primary',
  compact: 'brand.logo.icon',
  icon: 'brand.logo.icon',
  horizontal: 'brand.logo.horizontal',
  monochrome: 'brand.logo.monochrome',
};

const CONTEXT_TO_ASSET_ID: Record<BrandVisualContext, string> = {
  splash: 'brand.splash.main',
  loading: 'brand.loading.mascot',
  header: 'brand.logo.icon',
  profile: 'brand.logo.icon',
  share: 'brand.logo.primary',
  legal: 'brand.logo.monochrome',
  favicon: 'brand.logo.icon',
  notification: 'brand.icon.notification',
  pwa: 'brand.icon.pwa.512',
};

/** Known-good legacy path — never remove until replacements are validated. */
export const UNILIVES_KNOWN_GOOD_BRAND_FALLBACK = '/brand/app-logo.png';

export function brandAssetIdForVariant(variant: BrandMarkVariant): string {
  return VARIANT_TO_ASSET_ID[variant];
}

export function brandAssetIdForContext(context: BrandVisualContext): string {
  return CONTEXT_TO_ASSET_ID[context];
}

/**
 * Resolve a registry brand asset to a displayable URL.
 * Missing / empty registry entries → `/brand/app-logo.png`.
 */
export function resolveBrandRegistryUrl(
  assetId: string,
  options: AssetResolveOptions = {},
): string {
  const asset = resolveAsset(assetId);
  if (asset.status === 'missing' || asset.status === 'deprecated' || asset.version === 0) {
    return (
      (asset.fallback && !asset.fallback.includes('/unilives-assets/')
        ? asset.fallback
        : null) || UNILIVES_KNOWN_GOOD_BRAND_FALLBACK
    );
  }

  const flags = getAssetFeatureFlags();
  const reduced =
    options.prefersReducedMotion ??
    flags.forceReducedMotion ??
    detectPrefersReducedMotion();
  const lowPerf = options.lowPerformance ?? flags.forceLowPerformance;

  if (reduced || lowPerf) {
    if (asset.reducedMotionFallback && !asset.reducedMotionFallback.includes('/unilives-assets/')) {
      return asset.reducedMotionFallback;
    }
    if (asset.lowPerformanceFallback && !asset.lowPerformanceFallback.includes('/unilives-assets/')) {
      return asset.lowPerformanceFallback;
    }
    return UNILIVES_KNOWN_GOOD_BRAND_FALLBACK;
  }

  const url = getAssetUrl(assetId, options.preferredFormat, options);
  if (!url || url.includes('/unilives-assets/')) {
    if (asset.status !== 'production') {
      return UNILIVES_KNOWN_GOOD_BRAND_FALLBACK;
    }
  }
  return url || UNILIVES_KNOWN_GOOD_BRAND_FALLBACK;
}

export function resolveBrandVariantUrl(
  variant: BrandMarkVariant,
  options?: AssetResolveOptions,
): string {
  return resolveBrandRegistryUrl(brandAssetIdForVariant(variant), options);
}

export function resolveBrandContextUrl(
  context: BrandVisualContext,
  options?: AssetResolveOptions,
): string {
  return resolveBrandRegistryUrl(brandAssetIdForContext(context), options);
}

/** Animation policy for brand marks by surface. */
export type BrandAnimationMode = 'full' | 'short-loop' | 'subtle-idle' | 'static';

export function brandAnimationModeForContext(context: BrandVisualContext): BrandAnimationMode {
  switch (context) {
    case 'splash':
      return 'full';
    case 'loading':
      return 'short-loop';
    case 'header':
      return 'subtle-idle';
    default:
      return 'static';
  }
}

export function shouldUseAnimatedBrand(context: BrandVisualContext): boolean {
  const mode = brandAnimationModeForContext(context);
  if (mode === 'static') return false;
  if (detectPrefersReducedMotion() || getAssetFeatureFlags().forceReducedMotion) return false;
  if (getAssetFeatureFlags().forceLowPerformance || getAssetFeatureFlags().muteAnimations) {
    return false;
  }
  const animated = resolveAsset('brand.logo.animated');
  return animated.status === 'production' || animated.status === 'placeholder';
}
