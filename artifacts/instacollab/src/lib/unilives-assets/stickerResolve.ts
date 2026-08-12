/**
 * UniLive’s sticker visual resolution (Phase 8).
 *
 * Business sticker IDs stay authoritative for payloads/drafts.
 * Visual IDs are registry-only.
 *
 * Precedence:
 * 1. Valid remote / admin cover override
 * 2. Canonical registry when production|placeholder
 * 3. Legacy media URL or temporary emoji
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

export const UNILIVES_NEUTRAL_STICKER_FALLBACK = UNILIVES_KNOWN_GOOD_BRAND_FALLBACK;

/** Editor/story overlay stickers — business IDs are stable slugs; drafts may still store emoji. */
export const EDITOR_STICKER_CATALOG = [
  { id: 'fire', name: 'Fire', emoji: '🔥', category: 'reaction' as const },
  { id: 'sparkles', name: 'Sparkles', emoji: '✨', category: 'reaction' as const },
  { id: 'hundred', name: 'Hundred', emoji: '💯', category: 'reaction' as const },
  { id: 'party', name: 'Party', emoji: '🎉', category: 'reaction' as const },
  { id: 'heart', name: 'Heart', emoji: '❤️', category: 'reaction' as const },
  { id: 'joy', name: 'Joy', emoji: '😂', category: 'reaction' as const },
  { id: 'mountain', name: 'Mountain', emoji: '🏔️', category: 'static' as const },
  { id: 'camera', name: 'Camera', emoji: '📸', category: 'static' as const },
  { id: 'music', name: 'Music', emoji: '🎵', category: 'static' as const },
  { id: 'star', name: 'Star', emoji: '⭐', category: 'reaction' as const },
  { id: 'eyes', name: 'Eyes', emoji: '👀', category: 'reaction' as const },
  { id: 'rocket', name: 'Rocket', emoji: '🚀', category: 'reaction' as const },
] as const;

export type EditorStickerId = (typeof EDITOR_STICKER_CATALOG)[number]['id'];

export function editorStickerAssetId(businessId: string): string {
  const hit = EDITOR_STICKER_CATALOG.find((s) => s.id === businessId);
  const category = hit?.category ?? 'reaction';
  return `sticker.${category}.${businessId}`;
}

export function editorStickerIdFromEmoji(emoji: string): string | undefined {
  const hit = EDITOR_STICKER_CATALOG.find((s) => s.emoji === emoji);
  return hit?.id;
}

export function editorStickerEmojiFromId(businessId: string): string | undefined {
  return EDITOR_STICKER_CATALOG.find((s) => s.id === businessId)?.emoji;
}

export type StickerResolvedVisual =
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

export function getStickerReplacementMapping(
  businessStickerId: string | undefined | null,
): AssetReplacementMapping | undefined {
  const id = String(businessStickerId ?? '').trim();
  if (!id) return undefined;
  return listReplacementMappings().find(
    (m) =>
      m.type === 'sticker' &&
      m.preserveBusinessId &&
      m.existingId === id &&
      m.status !== 'rolled-back' &&
      m.status !== 'unmapped' &&
      m.status !== 'not-in-phase',
  );
}

export function resolveStickerCanonicalAssetId(
  businessStickerId: string | undefined | null,
): string | undefined {
  const mapped = getStickerReplacementMapping(businessStickerId)?.newAssetId;
  if (mapped) return mapped;
  const id = String(businessStickerId ?? '').trim();
  if (EDITOR_STICKER_CATALOG.some((s) => s.id === id)) return editorStickerAssetId(id);
  return undefined;
}

export function resolveStickerThumbnailVisual(input: {
  businessStickerId?: string | null;
  legacyIcon?: string | null;
  remoteIconOverride?: string | null;
  options?: AssetResolveOptions;
}): StickerResolvedVisual {
  const remote = String(input.remoteIconOverride ?? '').trim();
  if (remote && isMediaUrl(remote)) {
    return {
      kind: 'url',
      url: remote,
      format: 'remote',
      source: 'remote',
      usedFallback: false,
      canonicalAssetId: resolveStickerCanonicalAssetId(input.businessStickerId),
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
      canonicalAssetId: resolveStickerCanonicalAssetId(input.businessStickerId),
    };
  }

  const canonicalId = resolveStickerCanonicalAssetId(input.businessStickerId);
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

  const fromId = editorStickerEmojiFromId(String(input.businessStickerId ?? ''));
  if (fromId) {
    return {
      kind: 'emoji',
      emoji: fromId,
      source: 'legacy-emoji-temporary',
      canonicalAssetId: canonicalId,
      usedFallback: true,
    };
  }

  return {
    kind: 'url',
    url: UNILIVES_NEUTRAL_STICKER_FALLBACK,
    format: 'png',
    source: 'neutral',
    canonicalAssetId: canonicalId,
    usedFallback: true,
  };
}

export type StickerPlayMedia = {
  canonicalAssetId?: string;
  svgaUrl?: string;
  videoUrl?: string;
  staticUrl?: string;
  preferStatic: boolean;
  source: 'registry' | 'legacy' | 'neutral' | 'remote';
  playAudio: boolean;
};

export function resolveStickerPlayMedia(input: {
  businessStickerId?: string | null;
  remoteMediaUrl?: string | null;
  legacyMediaUrl?: string | null;
  options?: AssetResolveOptions;
}): StickerPlayMedia {
  const flags = getAssetFeatureFlags();
  const reduced =
    input.options?.prefersReducedMotion ??
    flags.forceReducedMotion ??
    detectPrefersReducedMotion();
  const lowPerf = input.options?.lowPerformance ?? flags.forceLowPerformance;
  const preferStatic = Boolean(reduced || lowPerf || input.options?.animationMuted);
  const canonicalId = resolveStickerCanonicalAssetId(input.businessStickerId);

  if (preferStatic) {
    const thumb = resolveStickerThumbnailVisual({
      businessStickerId: input.businessStickerId,
      remoteIconOverride: input.remoteMediaUrl,
      legacyIcon: input.legacyMediaUrl,
      options: input.options,
    });
    return {
      canonicalAssetId: canonicalId,
      staticUrl: thumb.kind === 'url' ? thumb.url : UNILIVES_NEUTRAL_STICKER_FALLBACK,
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
    staticUrl: UNILIVES_NEUTRAL_STICKER_FALLBACK,
    preferStatic: true,
    source: 'neutral',
    playAudio: false,
  };
}
