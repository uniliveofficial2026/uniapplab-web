import { resolveConfiguredFallback } from './fallbacks';
import {
  detectPrefersReducedMotion,
  getAssetFeatureFlags,
} from './featureFlags';
import { getRegisteredAsset, hasRegisteredAsset } from './registry';
import type {
  AssetFormat,
  AssetResolveOptions,
  ResolvedAssetUrl,
  UniLivesAsset,
} from './types';

/** Gift / animation preference order (when not reduced-motion / low-perf). */
const ANIMATION_FORMAT_ORDER: AssetFormat[] = [
  'svga',
  'webm',
  'mp4',
  'json',
  'webp',
  'png',
  'jpg',
  'svg',
];

const STATIC_FORMAT_ORDER: AssetFormat[] = [
  'webp',
  'png',
  'jpg',
  'svg',
  'json',
  'mp4',
  'webm',
  'svga',
];

function missingStub(assetId: string): UniLivesAsset {
  return {
    id: assetId,
    brand: "UniLive’s",
    name: assetId,
    category: 'ui',
    status: 'missing',
    version: 0,
    formats: {},
    fallback: '/brand/app-logo.png',
  };
}

export function resolveAsset(assetId: string): UniLivesAsset {
  const hit = getRegisteredAsset(assetId);
  if (hit) return hit;

  const flags = getAssetFeatureFlags();
  if (flags.strictUnknownIds) {
    throw new Error(`[unilives-assets] Unknown asset ID: ${assetId}`);
  }
  return missingStub(assetId);
}

function pickFormat(
  asset: UniLivesAsset,
  options: AssetResolveOptions,
): { format: AssetFormat | 'fallback'; url: string; usedFallback: boolean } {
  const flags = getAssetFeatureFlags();
  const reduced =
    options.prefersReducedMotion ??
    flags.forceReducedMotion ??
    detectPrefersReducedMotion();
  const lowPerf = options.lowPerformance ?? flags.forceLowPerformance;
  const muteAnim = options.animationMuted ?? flags.muteAnimations;

  if (reduced && asset.reducedMotionFallback) {
    return { format: 'fallback', url: asset.reducedMotionFallback, usedFallback: true };
  }
  if (lowPerf && asset.lowPerformanceFallback) {
    return { format: 'fallback', url: asset.lowPerformanceFallback, usedFallback: true };
  }
  if (muteAnim && (asset.reducedMotionFallback || asset.thumbnail)) {
    return {
      format: 'fallback',
      url: asset.reducedMotionFallback || asset.thumbnail!,
      usedFallback: true,
    };
  }

  if (options.preferredFormat && asset.formats[options.preferredFormat]) {
    return {
      format: options.preferredFormat,
      url: asset.formats[options.preferredFormat]!,
      usedFallback: false,
    };
  }

  const order =
    asset.category === 'gift' ||
    asset.category === 'seat-interaction' ||
    asset.category === 'avatar-ring'
      ? reduced || lowPerf || muteAnim
        ? STATIC_FORMAT_ORDER
        : ANIMATION_FORMAT_ORDER
      : STATIC_FORMAT_ORDER;

  for (const format of order) {
    const url = asset.formats[format];
    if (url) return { format, url, usedFallback: false };
  }

  if (asset.thumbnail) {
    return { format: 'fallback', url: asset.thumbnail, usedFallback: true };
  }

  return {
    format: 'fallback',
    url: resolveConfiguredFallback(asset),
    usedFallback: true,
  };
}

export function getAssetUrl(
  assetId: string,
  preferredFormat?: AssetFormat,
  options: AssetResolveOptions = {},
): string {
  const asset = resolveAsset(assetId);
  const picked = pickFormat(asset, { ...options, preferredFormat });
  return picked.url;
}

export function getAssetFallback(assetId: string): string {
  const asset = resolveAsset(assetId);
  return resolveConfiguredFallback(asset);
}

export function resolveAssetUrlDetailed(
  assetId: string,
  options: AssetResolveOptions = {},
): ResolvedAssetUrl {
  const asset = resolveAsset(assetId);
  const picked = pickFormat(asset, options);
  return {
    assetId,
    url: picked.url,
    format: picked.format,
    usedFallback: picked.usedFallback || asset.status === 'missing',
    status: asset.status,
  };
}

export function shouldPlayAssetAudio(
  assetId: string,
  options: AssetResolveOptions = {},
): boolean {
  const flags = getAssetFeatureFlags();
  if (options.soundDisabled ?? flags.disableSound) return false;
  const asset = resolveAsset(assetId);
  return Boolean(asset.audio);
}

export function getAssetAudioUrl(assetId: string): string | undefined {
  if (!shouldPlayAssetAudio(assetId)) return undefined;
  return resolveAsset(assetId).audio;
}

export function isKnownAssetId(assetId: string): boolean {
  return hasRegisteredAsset(assetId);
}
