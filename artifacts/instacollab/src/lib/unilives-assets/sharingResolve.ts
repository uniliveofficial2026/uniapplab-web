/**
 * UniLive’s sharing / QR visual resolution (Phase 10).
 * Visual-only — does not generate URLs, QR payloads, or invite codes.
 */

import { UNILIVES_KNOWN_GOOD_BRAND_FALLBACK } from './brandResolve';
import {
  detectPrefersReducedMotion,
  getAssetFeatureFlags,
} from './featureFlags';
import { getAssetUrl, resolveAsset } from './resolver';
import type { AssetResolveOptions } from './types';

export const UNILIVES_NEUTRAL_SHARING_FALLBACK = UNILIVES_KNOWN_GOOD_BRAND_FALLBACK;

export type SharingVisualKind =
  | 'qr-profile-frame'
  | 'qr-room-frame'
  | 'qr-live-frame'
  | 'qr-invite-frame'
  | 'qr-logo'
  | 'qr-fallback'
  | 'card-profile'
  | 'card-post'
  | 'card-room'
  | 'card-live'
  | 'card-invite'
  | 'card-logo'
  | 'card-watermark'
  | 'loading'
  | 'success'
  | 'error'
  | 'fallback';

const SHARING_VISUAL_IDS: Record<SharingVisualKind, string> = {
  'qr-profile-frame': 'sharing.qr.profile.frame',
  'qr-room-frame': 'sharing.qr.room.frame',
  'qr-live-frame': 'sharing.qr.live.frame',
  'qr-invite-frame': 'sharing.qr.invite.frame',
  'qr-logo': 'sharing.qr.logo',
  'qr-fallback': 'sharing.qr.fallback',
  'card-profile': 'sharing.card.profile.background',
  'card-post': 'sharing.card.post.background',
  'card-room': 'sharing.card.room.background',
  'card-live': 'sharing.card.live.background',
  'card-invite': 'sharing.card.invite.background',
  'card-logo': 'sharing.card.logo',
  'card-watermark': 'sharing.card.watermark',
  loading: 'sharing.state.loading',
  success: 'sharing.state.success',
  error: 'sharing.state.error',
  fallback: 'sharing.fallback.default',
};

export function resolveSharingCanonicalAssetId(kind: SharingVisualKind): string {
  return SHARING_VISUAL_IDS[kind];
}

/** Map share kind → card background asset (visual only). */
export function resolveShareCardBackgroundAssetId(
  kind: string | null | undefined,
): string {
  const k = String(kind ?? '').toLowerCase();
  if (k === 'profile' || k === 'karaoke-profile') return SHARING_VISUAL_IDS['card-profile'];
  if (k === 'party' || k === 'live') return k === 'live' ? SHARING_VISUAL_IDS['card-live'] : SHARING_VISUAL_IDS['card-room'];
  if (k === 'post' || k === 'reel' || k === 'story') return SHARING_VISUAL_IDS['card-post'];
  return SHARING_VISUAL_IDS['card-logo'];
}

export type SharingMediaVisual = {
  url: string;
  source: 'registry' | 'legacy' | 'neutral';
  canonicalAssetId: string;
  usedFallback: boolean;
};

export function resolveSharingMediaUrl(
  kind: SharingVisualKind,
  options: AssetResolveOptions & { legacyUrl?: string | null } = {},
): SharingMediaVisual {
  const id = resolveSharingCanonicalAssetId(kind);
  const asset = resolveAsset(id);
  const flags = getAssetFeatureFlags();
  const reduced =
    options.prefersReducedMotion ??
    flags.forceReducedMotion ??
    detectPrefersReducedMotion();
  const lowPerf = options.lowPerformance ?? flags.forceLowPerformance;

  if (asset.status === 'production' || asset.status === 'placeholder') {
    if (reduced || lowPerf) {
      const staticUrl =
        asset.reducedMotionFallback ||
        asset.lowPerformanceFallback ||
        asset.thumbnail ||
        asset.formats.webp ||
        asset.formats.png ||
        asset.formats.svg;
      if (staticUrl) {
        return { url: staticUrl, source: 'registry', canonicalAssetId: id, usedFallback: true };
      }
    }
    const url = getAssetUrl(id, options.preferredFormat ?? 'webp', options);
    if (url) {
      return { url, source: 'registry', canonicalAssetId: id, usedFallback: false };
    }
  }

  if (options.legacyUrl) {
    return { url: options.legacyUrl, source: 'legacy', canonicalAssetId: id, usedFallback: true };
  }

  return {
    url: UNILIVES_NEUTRAL_SHARING_FALLBACK,
    source: 'neutral',
    canonicalAssetId: id,
    usedFallback: true,
  };
}
