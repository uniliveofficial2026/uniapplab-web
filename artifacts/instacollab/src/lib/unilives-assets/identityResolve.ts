/**
 * UniLive’s identity adornment visual resolution (Phase 9).
 *
 * Authoritative identity state → display mapping → canonical asset ID → resolver.
 * Visual assets never grant entitlement. visualOnly: true.
 */

import { UNILIVES_KNOWN_GOOD_BRAND_FALLBACK } from './brandResolve';
import {
  detectPrefersReducedMotion,
  getAssetFeatureFlags,
} from './featureFlags';
import { listReplacementMappings } from './registry';
import { getAssetUrl, resolveAsset } from './resolver';
import type { AssetResolveOptions, AssetReplacementMapping } from './types';

export const UNILIVES_NEUTRAL_IDENTITY_FALLBACK = UNILIVES_KNOWN_GOOD_BRAND_FALLBACK;

export type VipDisplayTier = 'none' | 'default' | 'svip' | 'vvip';
export type RoomRoleDisplay = 'none' | 'host' | 'cohost' | 'moderator' | 'admin' | 'creator' | 'supporter';

/** Display-only level buckets — stored level is unchanged. */
export function levelDisplayBucket(level: number): {
  bucket: string;
  canonicalAssetId: string;
  rangeLabel: string;
} {
  const lv = Math.max(1, Math.floor(level));
  if (lv >= 50) {
    return { bucket: '50+', canonicalAssetId: 'badge.level.50', rangeLabel: '50+' };
  }
  if (lv >= 25) {
    return { bucket: '25-49', canonicalAssetId: 'badge.level.25', rangeLabel: '25–49' };
  }
  if (lv >= 10) {
    return { bucket: '10-24', canonicalAssetId: 'badge.level.10', rangeLabel: '10–24' };
  }
  return { bucket: '1-9', canonicalAssetId: 'badge.level.default', rangeLabel: '1–9' };
}

export function resolveVerificationBadgeAssetId(isVerified: boolean): string | undefined {
  if (!isVerified) return undefined;
  return (
    getIdentityMapping('verification', 'true')?.newAssetId ?? 'badge.official.verified'
  );
}

/**
 * Profile premium (active) → VIP default visual.
 * Product model has profile premium, not separate SVIP/VVIP fields on User.
 */
export function resolveVipBadgeAssetId(input: {
  premiumActive?: boolean;
  vipTier?: VipDisplayTier | string | null;
}): string | undefined {
  const tier = String(input.vipTier ?? '').trim().toLowerCase();
  if (tier === 'vvip') return 'badge.vip.vvip';
  if (tier === 'svip') return 'badge.vip.svip';
  if (tier === 'default' || tier === 'vip') return 'badge.vip.default';
  if (input.premiumActive) return 'badge.vip.default';
  return undefined;
}

export function resolveVipRingAssetId(input: {
  premiumActive?: boolean;
  vipTier?: VipDisplayTier | string | null;
}): string | undefined {
  const tier = String(input.vipTier ?? '').trim().toLowerCase();
  if (tier === 'vvip') return 'ring.vip.vvip';
  if (tier === 'svip') return 'ring.vip.svip';
  if (tier === 'default' || tier === 'vip' || input.premiumActive) return 'ring.vip.default';
  return undefined;
}

export function resolveLevelBadgeAssetId(level: number): string {
  return levelDisplayBucket(level).canonicalAssetId;
}

export function resolveRoleBadgeAssetId(role: RoomRoleDisplay | string | null | undefined): string | undefined {
  const r = String(role ?? '').trim().toLowerCase();
  if (!r || r === 'none' || r === 'user') return undefined;
  const map: Record<string, string> = {
    host: 'badge.host.elite',
    cohost: 'badge.role.cohost',
    moderator: 'badge.role.moderator',
    admin: 'badge.role.admin',
    creator: 'badge.creator.default',
    supporter: 'badge.role.supporter',
  };
  return map[r] ?? getIdentityMapping('role', r)?.newAssetId;
}

/** Legacy CSS seat frameStyle → canonical frame ID (visual only; style string unchanged). */
export function resolveFrameAssetIdFromLegacyStyle(frameStyle: string | null | undefined): string | undefined {
  const style = String(frameStyle ?? '').trim().toLowerCase();
  if (!style || style === 'none' || style === 'default') return undefined;
  if (style === 'cyan-crown' || style === 'cyan') return 'frame.seat.video.host';
  if (style === 'gold-wings' || style === 'gold') return 'frame.seat.audio.vip';
  if (style === 'vip') return 'frame.comment.vip';
  if (style === 'unicorn-dream' || style === 'unicorn') return 'frame.profile.unicorn-dream';
  return getIdentityMapping('frame-style', style)?.newAssetId;
}

/**
 * Live/story status rings are status indicators (not VIP entitlement).
 * Map to standard ring for registry documentation; CSS gradient remains active fallback.
 */
export function resolveStatusRingAssetId(status: 'live' | 'story' | 'none' | string | null | undefined): string | undefined {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === 'live' || s === 'story') return 'ring.standard.default';
  return undefined;
}

function getIdentityMapping(
  identityType: string,
  authoritativeValue: string,
): AssetReplacementMapping | undefined {
  return listReplacementMappings().find(
    (m) =>
      (m.type === 'badge' || m.type === 'avatar-ring' || m.type === 'frame') &&
      m.preserveBusinessId &&
      m.existingId === `${identityType}:${authoritativeValue}` &&
      m.status !== 'rolled-back' &&
      m.status !== 'unmapped' &&
      m.status !== 'not-in-phase',
  );
}

export type IdentityMediaVisual = {
  url: string;
  source: 'registry' | 'legacy' | 'neutral';
  canonicalAssetId?: string;
  usedFallback: boolean;
};

export function resolveIdentityMediaUrl(
  canonicalAssetId: string | undefined | null,
  options: AssetResolveOptions & { legacyUrl?: string | null } = {},
): IdentityMediaVisual {
  const id = String(canonicalAssetId ?? '').trim();
  if (!id) {
    if (options.legacyUrl) {
      return { url: options.legacyUrl, source: 'legacy', usedFallback: true };
    }
    return {
      url: UNILIVES_NEUTRAL_IDENTITY_FALLBACK,
      source: 'neutral',
      usedFallback: true,
    };
  }

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
        return {
          url: staticUrl,
          source: 'registry',
          canonicalAssetId: id,
          usedFallback: true,
        };
      }
    }
    const url = getAssetUrl(id, options.preferredFormat ?? 'webp', options);
    if (url) {
      return { url, source: 'registry', canonicalAssetId: id, usedFallback: false };
    }
  }

  if (options.legacyUrl) {
    return {
      url: options.legacyUrl,
      source: 'legacy',
      canonicalAssetId: id,
      usedFallback: true,
    };
  }

  return {
    url: UNILIVES_NEUTRAL_IDENTITY_FALLBACK,
    source: 'neutral',
    canonicalAssetId: id,
    usedFallback: true,
  };
}
