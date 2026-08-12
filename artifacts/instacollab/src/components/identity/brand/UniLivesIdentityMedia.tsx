import React from 'react';
import { resolveAsset } from '../../../lib/unilives-assets/resolver';
import { resolveIdentityMediaUrl } from '../../../lib/unilives-assets/identityResolve';
import type { AssetResolveOptions } from '../../../lib/unilives-assets/types';

type Props = {
  canonicalAssetId?: string | null;
  legacyUrl?: string | null;
  /** Prefer this when production registry media is missing (e.g. existing Lucide icon). */
  legacyNode?: React.ReactNode;
  className?: string;
  imgClassName?: string;
  alt?: string;
  decorative?: boolean;
  resolveOptions?: AssetResolveOptions;
};

/**
 * Shared identity media.
 * Production/placeholder registry → img URL.
 * Missing → legacyNode if provided, else legacyUrl, else brand mark.
 */
export function UniLivesIdentityMedia({
  canonicalAssetId,
  legacyUrl,
  legacyNode,
  className = '',
  imgClassName = 'h-3.5 w-3.5 object-contain',
  alt = '',
  decorative = true,
  resolveOptions,
}: Props) {
  const id = String(canonicalAssetId ?? '').trim();
  const asset = id ? resolveAsset(id) : null;
  const hasProduction = asset && (asset.status === 'production' || asset.status === 'placeholder');

  if (!hasProduction) {
    if (legacyNode) {
      return (
        <span
          className={className}
          data-unilives-identity-media="legacy-node"
          data-canonical-asset-id={id || undefined}
          aria-hidden={decorative || !alt ? true : undefined}
        >
          {legacyNode}
        </span>
      );
    }
  }

  const visual = resolveIdentityMediaUrl(canonicalAssetId, { ...resolveOptions, legacyUrl });

  return (
    <img
      src={visual.url}
      alt={decorative ? '' : alt}
      className={`${imgClassName} ${className}`.trim()}
      draggable={false}
      loading="lazy"
      decoding="async"
      aria-hidden={decorative || !alt ? true : undefined}
      data-unilives-identity-media={visual.source}
      data-canonical-asset-id={visual.canonicalAssetId}
      onError={(e) => {
        const img = e.currentTarget;
        if (img.dataset.fallbackApplied === '1') return;
        img.dataset.fallbackApplied = '1';
        img.src = '/brand/app-logo.png';
      }}
    />
  );
}
