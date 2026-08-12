/**
 * UniLive’s gift visual resolution (Phase 7).
 *
 * Business gift IDs stay authoritative for wallet, transactions, ranking, and events.
 * Visual IDs are registry-only and must never rename or replace business IDs.
 *
 * Precedence:
 * 1. Valid remote / admin media override (when provided)
 * 2. Canonical registry when status is production|placeholder
 * 3. Existing legacy gift asset (/live-gifts/* or catalog effect URL)
 * 4. Neutral known-good fallback (/brand/app-logo.png)
 *
 * Temporary emoji display remains only when the catalog still stores emoji as the
 * sole legacy artwork — not as a claimed production asset.
 */

import { UNILIVES_KNOWN_GOOD_BRAND_FALLBACK } from './brandResolve';
import {
  detectPrefersReducedMotion,
  getAssetFeatureFlags,
} from './featureFlags';
import { listReplacementMappings } from './registry';
import { getAssetUrl, resolveAsset, resolveAssetUrlDetailed } from './resolver';
import type { AssetResolveOptions, AssetReplacementMapping } from './types';

/** Reserved visual ID — must never be the active mapping for business gift `universe`. */
export const GIFT_MYTHIC_UNIVERSE_RESERVED_ID = 'gift.mythic.universe';

export const UNILIVES_NEUTRAL_GIFT_FALLBACK = UNILIVES_KNOWN_GOOD_BRAND_FALLBACK;

/** Working legacy SVGAs retained until production replacements are approved. */
export const LEGACY_GIFT_SVGA_BY_BUSINESS_ID: Readonly<Record<string, string>> = {
  mic: '/live-gifts/mic.svga',
  star: '/live-gifts/star.svga',
  crown: '/live-gifts/crown.svga',
  rocket: '/live-gifts/rocket.svga',
  diamond: '/live-gifts/crown.svga',
  castle: '/live-gifts/rocket.svga',
  phoenix: '/live-gifts/rocket.svga',
  unicorn: '/live-gifts/crown.svga',
  galaxy: '/live-gifts/star.svga',
  dragon: '/live-gifts/rocket.svga',
  universe: '/live-gifts/crown.svga',
  eternity: '/live-gifts/star.svga',
  divine: '/live-gifts/crown.svga',
  royal_crown: '/live-gifts/crown.svga',
  crystal_diamond: '/live-gifts/crown.svga',
  golden_dragon: '/live-gifts/rocket.svga',
  studio_phoenix: '/live-gifts/rocket.svga',
  crystal_castle: '/live-gifts/rocket.svga',
  galaxy_portal: '/live-gifts/star.svga',
  flying_unicorn: '/live-gifts/crown.svga',
  space_rocket: '/live-gifts/rocket.svga',
  universe_creation: '/live-gifts/crown.svga',
  king_of_dragons: '/live-gifts/rocket.svga',
  galaxy_emperor: '/live-gifts/star.svga',
  cosmic_phoenix: '/live-gifts/rocket.svga',
  eternal_ocean: '/live-gifts/crown.svga',
  solar_dragon: '/live-gifts/rocket.svga',
  supernova_prime: '/live-gifts/star.svga',
  vip_crown: '/live-gifts/crown.svga',
  vip_lambo: '/live-gifts/rocket.svga',
};

export type GiftVisualContext = 'thumbnail' | 'preview' | 'animation' | 'static';

export type GiftResolvedVisual =
  | {
      kind: 'url';
      url: string;
      format: string;
      source: 'remote' | 'registry' | 'legacy' | 'neutral';
      canonicalAssetId?: string;
      usedFallback: boolean;
    }
  | {
      kind: 'emoji';
      emoji: string;
      source: 'legacy-emoji-temporary';
      canonicalAssetId?: string;
      usedFallback: true;
    };

function isMediaUrl(value: string | null | undefined): boolean {
  const v = String(value ?? '').trim();
  if (!v) return false;
  return (
    /^https?:\/\//i.test(v) ||
    v.startsWith('data:image/') ||
    v.startsWith('blob:') ||
    /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(v)
  );
}

function isUsableRegistryAsset(assetId: string): boolean {
  const asset = resolveAsset(assetId);
  return asset.status === 'production' || asset.status === 'placeholder';
}

/** Active gift mapping for a business gift ID (never gift.mythic.universe for universe). */
export function getGiftReplacementMapping(
  businessGiftId: string | undefined | null,
): AssetReplacementMapping | undefined {
  const id = String(businessGiftId ?? '').trim();
  if (!id) return undefined;
  const maps = listReplacementMappings().filter(
    (m) =>
      m.type === 'gift' &&
      m.preserveBusinessId &&
      m.existingId === id &&
      m.status !== 'rolled-back' &&
      m.status !== 'unmapped' &&
      m.status !== 'not-in-phase',
  );
  const active = maps.find((m) => m.newAssetId !== GIFT_MYTHIC_UNIVERSE_RESERVED_ID);
  return active;
}

export function resolveGiftCanonicalAssetId(
  businessGiftId: string | undefined | null,
): string | undefined {
  const mapping = getGiftReplacementMapping(businessGiftId);
  if (!mapping) return undefined;
  if (mapping.newAssetId === GIFT_MYTHIC_UNIVERSE_RESERVED_ID) return undefined;
  return mapping.newAssetId;
}

export function resolveLegacyGiftAnimationUrl(
  businessGiftId: string | undefined | null,
  catalogSvgaUrl?: string | null,
): string | undefined {
  const id = String(businessGiftId ?? '').trim();
  if (catalogSvgaUrl && String(catalogSvgaUrl).trim()) return String(catalogSvgaUrl).trim();
  if (id && LEGACY_GIFT_SVGA_BY_BUSINESS_ID[id]) return LEGACY_GIFT_SVGA_BY_BUSINESS_ID[id];
  return undefined;
}

/**
 * Resolve picker / preview thumbnail visual for a business gift.
 * Does not read or alter prices.
 */
export function resolveGiftThumbnailVisual(input: {
  businessGiftId?: string | null;
  legacyIcon?: string | null;
  remoteIconOverride?: string | null;
  options?: AssetResolveOptions;
}): GiftResolvedVisual {
  const remote = String(input.remoteIconOverride ?? '').trim();
  if (remote && isMediaUrl(remote)) {
    return {
      kind: 'url',
      url: remote,
      format: 'remote',
      source: 'remote',
      usedFallback: false,
      canonicalAssetId: resolveGiftCanonicalAssetId(input.businessGiftId),
    };
  }

  const legacyIcon = String(input.legacyIcon ?? '').trim();
  if (legacyIcon && isMediaUrl(legacyIcon)) {
    // Catalog/admin already stores a media URL — treat as legacy/remote artwork.
    return {
      kind: 'url',
      url: legacyIcon,
      format: 'legacy-media',
      source: 'legacy',
      usedFallback: false,
      canonicalAssetId: resolveGiftCanonicalAssetId(input.businessGiftId),
    };
  }

  const canonicalId = resolveGiftCanonicalAssetId(input.businessGiftId);
  if (canonicalId && isUsableRegistryAsset(canonicalId)) {
    const detailed = resolveAssetUrlDetailed(canonicalId, {
      ...input.options,
      preferredFormat: input.options?.preferredFormat ?? 'webp',
    });
    const url = getAssetUrl(canonicalId, 'webp', input.options);
    if (url && !url.endsWith('.svga') && !url.endsWith('.webm')) {
      return {
        kind: 'url',
        url,
        format: detailed.format,
        source: 'registry',
        canonicalAssetId: canonicalId,
        usedFallback: detailed.usedFallback,
      };
    }
  }

  // Temporary: catalog emoji still present until production thumbnails exist.
  if (legacyIcon && !isMediaUrl(legacyIcon)) {
    return {
      kind: 'emoji',
      emoji: legacyIcon,
      source: 'legacy-emoji-temporary',
      canonicalAssetId: canonicalId,
      usedFallback: true,
    };
  }

  return {
    kind: 'url',
    url: UNILIVES_NEUTRAL_GIFT_FALLBACK,
    format: 'png',
    source: 'neutral',
    canonicalAssetId: canonicalId,
    usedFallback: true,
  };
}

export type GiftPlayMedia = {
  canonicalAssetId?: string;
  svgaUrl?: string;
  videoUrl?: string;
  staticUrl?: string;
  preferStatic: boolean;
  source: 'registry' | 'legacy' | 'neutral';
  playAudio: boolean;
};

/**
 * Resolve send-animation media from the authoritative business gift ID.
 * Lookup key is business ID → mapping → canonical visual ID (never name/index/price).
 */
export function resolveGiftPlayMedia(input: {
  businessGiftId?: string | null;
  legacySvgaUrl?: string | null;
  legacyVideoUrl?: string | null;
  options?: AssetResolveOptions;
}): GiftPlayMedia {
  const flags = getAssetFeatureFlags();
  const reduced =
    input.options?.prefersReducedMotion ??
    flags.forceReducedMotion ??
    detectPrefersReducedMotion();
  const lowPerf = input.options?.lowPerformance ?? flags.forceLowPerformance;
  const preferStatic = Boolean(reduced || lowPerf || input.options?.animationMuted);

  const canonicalId = resolveGiftCanonicalAssetId(input.businessGiftId);
  const legacySvga = resolveLegacyGiftAnimationUrl(
    input.businessGiftId,
    input.legacySvgaUrl,
  );
  const legacyVideo = String(input.legacyVideoUrl ?? '').trim() || undefined;

  if (preferStatic) {
    const thumb = resolveGiftThumbnailVisual({
      businessGiftId: input.businessGiftId,
      options: input.options,
    });
    const staticUrl =
      thumb.kind === 'url' ? thumb.url : UNILIVES_NEUTRAL_GIFT_FALLBACK;
    return {
      canonicalAssetId: canonicalId,
      staticUrl,
      preferStatic: true,
      source: thumb.kind === 'url' && thumb.source === 'registry' ? 'registry' : 'neutral',
      playAudio: false,
    };
  }

  if (canonicalId && isUsableRegistryAsset(canonicalId)) {
    const asset = resolveAsset(canonicalId);
    const svga = asset.formats.svga;
    const webm = asset.formats.webm;
    if (svga || webm) {
      return {
        canonicalAssetId: canonicalId,
        svgaUrl: svga,
        videoUrl: webm,
        preferStatic: false,
        source: 'registry',
        playAudio: Boolean(asset.audio) && !(input.options?.soundDisabled ?? flags.disableSound),
      };
    }
  }

  if (legacyVideo || legacySvga) {
    return {
      canonicalAssetId: canonicalId,
      svgaUrl: legacySvga,
      videoUrl: legacyVideo,
      preferStatic: false,
      source: 'legacy',
      playAudio: false,
    };
  }

  return {
    canonicalAssetId: canonicalId,
    staticUrl: UNILIVES_NEUTRAL_GIFT_FALLBACK,
    preferStatic: true,
    source: 'neutral',
    playAudio: false,
  };
}
