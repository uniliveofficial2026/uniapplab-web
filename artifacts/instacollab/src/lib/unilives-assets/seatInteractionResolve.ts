/**
 * UniLive’s seat-interaction visual resolution (Phase 8).
 *
 * Business interaction IDs stay authoritative for events/permissions/cooldowns.
 * Visual IDs are registry-only. Does not resolve seats, permissions, or payloads.
 *
 * Precedence:
 * 1. Valid remote visual override
 * 2. Canonical registry when production|placeholder
 * 3. Legacy media URL / temporary emoji
 * 4. Neutral /brand/app-logo.png
 */

import { UNILIVES_KNOWN_GOOD_BRAND_FALLBACK } from './brandResolve';
import {
  detectPrefersReducedMotion,
  getAssetFeatureFlags,
} from './featureFlags';
import { listReplacementMappings } from './registry';
import { getAssetUrl, resolveAsset, resolveAssetUrlDetailed } from './resolver';
import type { AssetResolveOptions, AssetReplacementMapping } from './types';

export const UNILIVES_NEUTRAL_INTERACTION_FALLBACK = UNILIVES_KNOWN_GOOD_BRAND_FALLBACK;

/**
 * Registered seat-interaction catalog (visual registry alignment).
 * Runtime room picker for these effects is not present in product yet —
 * do not invent send/event behavior. Visual helpers only.
 */
export const SEAT_INTERACTION_CATALOG = [
  {
    id: 'kiss',
    name: 'Kiss',
    category: 'social' as const,
    emoji: '💋',
    assetId: 'interaction.kiss',
    sourceTargetMode: 'user-to-user' as const,
    permissionScope: 'any-seated' as const,
    cooldownReference: 'client-catalog-unset',
  },
  {
    id: 'hug',
    name: 'Hug',
    category: 'social' as const,
    emoji: '🤗',
    assetId: 'interaction.hug',
    sourceTargetMode: 'user-to-user' as const,
    permissionScope: 'any-seated' as const,
    cooldownReference: 'client-catalog-unset',
  },
  {
    id: 'high_five',
    name: 'High five',
    category: 'social' as const,
    emoji: '🙌',
    assetId: 'interaction.high-five',
    sourceTargetMode: 'user-to-user' as const,
    permissionScope: 'any-seated' as const,
    cooldownReference: 'client-catalog-unset',
  },
  {
    id: 'pillow_fight',
    name: 'Pillow fight',
    category: 'social' as const,
    emoji: '🛏️',
    assetId: 'interaction.pillow-fight',
    sourceTargetMode: 'user-to-user' as const,
    permissionScope: 'any-seated' as const,
    cooldownReference: 'client-catalog-unset',
  },
  {
    id: 'love_you',
    name: 'Love you',
    category: 'social' as const,
    emoji: '😍',
    assetId: 'interaction.love-you',
    sourceTargetMode: 'user-to-user' as const,
    permissionScope: 'any-seated' as const,
    cooldownReference: 'client-catalog-unset',
  },
  {
    id: 'cheer',
    name: 'Cheer',
    category: 'social' as const,
    emoji: '📣',
    assetId: 'interaction.cheer',
    sourceTargetMode: 'user-to-user' as const,
    permissionScope: 'any-seated' as const,
    cooldownReference: 'client-catalog-unset',
  },
  {
    id: 'crown',
    name: 'Crown',
    category: 'effect' as const,
    emoji: '👑',
    assetId: 'interaction.crown',
    sourceTargetMode: 'user-to-user' as const,
    permissionScope: 'host-or-moderator-unset' as const,
    cooldownReference: 'client-catalog-unset',
  },
  {
    id: 'freeze',
    name: 'Freeze',
    category: 'effect' as const,
    emoji: '❄️',
    assetId: 'interaction.freeze',
    sourceTargetMode: 'user-to-user' as const,
    permissionScope: 'host-or-moderator-unset' as const,
    cooldownReference: 'client-catalog-unset',
  },
  {
    id: 'fire',
    name: 'Fire',
    category: 'effect' as const,
    emoji: '🔥',
    assetId: 'interaction.fire',
    sourceTargetMode: 'user-to-user' as const,
    permissionScope: 'any-seated' as const,
    cooldownReference: 'client-catalog-unset',
  },
  {
    id: 'confetti',
    name: 'Confetti',
    category: 'effect' as const,
    emoji: '🎊',
    assetId: 'interaction.confetti',
    sourceTargetMode: 'room-or-target' as const,
    permissionScope: 'any-seated' as const,
    cooldownReference: 'client-catalog-unset',
  },
] as const;

export type SeatInteractionBusinessId = (typeof SEAT_INTERACTION_CATALOG)[number]['id'];

export type InteractionResolvedVisual =
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

export function getSeatInteractionReplacementMapping(
  businessId: string | undefined | null,
): AssetReplacementMapping | undefined {
  const id = String(businessId ?? '').trim();
  if (!id) return undefined;
  return listReplacementMappings().find(
    (m) =>
      m.type === 'seat-interaction' &&
      m.preserveBusinessId &&
      m.existingId === id &&
      m.status !== 'rolled-back' &&
      m.status !== 'unmapped' &&
      m.status !== 'not-in-phase',
  );
}

export function resolveSeatInteractionCanonicalAssetId(
  businessId: string | undefined | null,
): string | undefined {
  const mapped = getSeatInteractionReplacementMapping(businessId)?.newAssetId;
  if (mapped) return mapped;
  const hit = SEAT_INTERACTION_CATALOG.find((i) => i.id === businessId);
  return hit?.assetId;
}

export function resolveSeatInteractionThumbnailVisual(input: {
  businessInteractionId?: string | null;
  legacyIcon?: string | null;
  remoteIconOverride?: string | null;
  options?: AssetResolveOptions;
}): InteractionResolvedVisual {
  const remote = String(input.remoteIconOverride ?? '').trim();
  if (remote && isMediaUrl(remote)) {
    return {
      kind: 'url',
      url: remote,
      format: 'remote',
      source: 'remote',
      usedFallback: false,
      canonicalAssetId: resolveSeatInteractionCanonicalAssetId(input.businessInteractionId),
    };
  }

  const legacyIcon = String(input.legacyIcon ?? '').trim();
  if (legacyIcon && isMediaUrl(legacyIcon)) {
    return {
      kind: 'url',
      url: legacyIcon,
      format: 'legacy-media',
      source: 'legacy',
      usedFallback: false,
      canonicalAssetId: resolveSeatInteractionCanonicalAssetId(input.businessInteractionId),
    };
  }

  const canonicalId = resolveSeatInteractionCanonicalAssetId(input.businessInteractionId);
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

  if (legacyIcon && !isMediaUrl(legacyIcon)) {
    return {
      kind: 'emoji',
      emoji: legacyIcon,
      source: 'legacy-emoji-temporary',
      canonicalAssetId: canonicalId,
      usedFallback: true,
    };
  }

  const catalogEmoji = SEAT_INTERACTION_CATALOG.find(
    (i) => i.id === input.businessInteractionId,
  )?.emoji;
  if (catalogEmoji) {
    return {
      kind: 'emoji',
      emoji: catalogEmoji,
      source: 'legacy-emoji-temporary',
      canonicalAssetId: canonicalId,
      usedFallback: true,
    };
  }

  return {
    kind: 'url',
    url: UNILIVES_NEUTRAL_INTERACTION_FALLBACK,
    format: 'png',
    source: 'neutral',
    canonicalAssetId: canonicalId,
    usedFallback: true,
  };
}

export type SeatInteractionPlayMedia = {
  canonicalAssetId?: string;
  svgaUrl?: string;
  videoUrl?: string;
  staticUrl?: string;
  preferStatic: boolean;
  source: 'registry' | 'legacy' | 'neutral' | 'remote';
  playAudio: boolean;
};

export function resolveSeatInteractionPlayMedia(input: {
  businessInteractionId?: string | null;
  remoteMediaUrl?: string | null;
  legacyMediaUrl?: string | null;
  options?: AssetResolveOptions;
}): SeatInteractionPlayMedia {
  const flags = getAssetFeatureFlags();
  const reduced =
    input.options?.prefersReducedMotion ??
    flags.forceReducedMotion ??
    detectPrefersReducedMotion();
  const lowPerf = input.options?.lowPerformance ?? flags.forceLowPerformance;
  const preferStatic = Boolean(reduced || lowPerf || input.options?.animationMuted);
  const canonicalId = resolveSeatInteractionCanonicalAssetId(input.businessInteractionId);

  if (preferStatic) {
    const thumb = resolveSeatInteractionThumbnailVisual({
      businessInteractionId: input.businessInteractionId,
      remoteIconOverride: input.remoteMediaUrl,
      legacyIcon: input.legacyMediaUrl,
      options: input.options,
    });
    return {
      canonicalAssetId: canonicalId,
      staticUrl: thumb.kind === 'url' ? thumb.url : UNILIVES_NEUTRAL_INTERACTION_FALLBACK,
      preferStatic: true,
      source: thumb.kind === 'url' ? thumb.source : 'neutral',
      playAudio: false,
    };
  }

  const remote = String(input.remoteMediaUrl ?? '').trim();
  if (remote && isMediaUrl(remote)) {
    const isVideo = /\.(webm|mp4)(\?|$)/i.test(remote);
    return {
      canonicalAssetId: canonicalId,
      videoUrl: isVideo ? remote : undefined,
      staticUrl: isVideo ? undefined : remote,
      preferStatic: !isVideo,
      source: 'remote',
      playAudio: false,
    };
  }

  if (canonicalId && isUsableRegistryAsset(canonicalId)) {
    const asset = resolveAsset(canonicalId);
    return {
      canonicalAssetId: canonicalId,
      svgaUrl: asset.formats.svga,
      videoUrl: asset.formats.webm,
      preferStatic: false,
      source: 'registry',
      playAudio: Boolean(asset.audio) && !(input.options?.soundDisabled ?? flags.disableSound),
    };
  }

  const legacy = String(input.legacyMediaUrl ?? '').trim();
  if (legacy && isMediaUrl(legacy)) {
    return {
      canonicalAssetId: canonicalId,
      staticUrl: legacy,
      preferStatic: true,
      source: 'legacy',
      playAudio: false,
    };
  }

  return {
    canonicalAssetId: canonicalId,
    staticUrl: UNILIVES_NEUTRAL_INTERACTION_FALLBACK,
    preferStatic: true,
    source: 'neutral',
    playAudio: false,
  };
}
