/**
 * UniLive’s legal visual resolution (Phase 10).
 * Visual-only — does not fetch documents, accept consent, or alter versions.
 */

import { UNILIVES_KNOWN_GOOD_BRAND_FALLBACK } from './brandResolve';
import {
  detectPrefersReducedMotion,
  getAssetFeatureFlags,
} from './featureFlags';
import { getAssetUrl, resolveAsset } from './resolver';
import type { AssetResolveOptions } from './types';

export const UNILIVES_NEUTRAL_LEGAL_FALLBACK = UNILIVES_KNOWN_GOOD_BRAND_FALLBACK;

export type LegalVisualKind =
  | 'document-background'
  | 'document-header'
  | 'document-footer'
  | 'terms-icon'
  | 'privacy-icon'
  | 'community-icon'
  | 'copyright-icon'
  | 'safety-icon'
  | 'consent-icon'
  | 'loading'
  | 'error'
  | 'success'
  | 'fallback';

const LEGAL_VISUAL_IDS: Record<LegalVisualKind, string> = {
  'document-background': 'legal.document.background',
  'document-header': 'legal.document.header',
  'document-footer': 'legal.document.footer',
  'terms-icon': 'legal.terms.icon',
  'privacy-icon': 'legal.privacy.icon',
  'community-icon': 'legal.community.icon',
  'copyright-icon': 'legal.copyright.icon',
  'safety-icon': 'legal.safety.icon',
  'consent-icon': 'legal.consent.icon',
  loading: 'legal.state.loading',
  error: 'legal.state.error',
  success: 'legal.state.success',
  fallback: 'legal.fallback.default',
};

export function resolveLegalCanonicalAssetId(kind: LegalVisualKind): string {
  return LEGAL_VISUAL_IDS[kind];
}

export type LegalMediaVisual = {
  url: string;
  source: 'registry' | 'legacy' | 'neutral';
  canonicalAssetId: string;
  usedFallback: boolean;
};

export function resolveLegalMediaUrl(
  kind: LegalVisualKind,
  options: AssetResolveOptions & { legacyUrl?: string | null } = {},
): LegalMediaVisual {
  const id = resolveLegalCanonicalAssetId(kind);
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
    url: UNILIVES_NEUTRAL_LEGAL_FALLBACK,
    source: 'neutral',
    canonicalAssetId: id,
    usedFallback: true,
  };
}
