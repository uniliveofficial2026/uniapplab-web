import React from 'react';
import { resolveAsset } from '../../../lib/unilives-assets/resolver';
import {
  resolveSharingMediaUrl,
  type SharingVisualKind,
} from '../../../lib/unilives-assets/sharingResolve';

type Props = {
  kind: SharingVisualKind;
  legacyNode?: React.ReactNode;
  legacyUrl?: string | null;
  className?: string;
  imgClassName?: string;
  alt?: string;
  decorative?: boolean;
};

export function UniLivesSharingMedia({
  kind,
  legacyNode,
  legacyUrl,
  className = '',
  imgClassName = 'h-4 w-4 object-contain',
  alt = '',
  decorative = true,
}: Props) {
  const visual = resolveSharingMediaUrl(kind, { legacyUrl });
  const asset = resolveAsset(visual.canonicalAssetId);
  const hasProduction = asset.status === 'production' || asset.status === 'placeholder';

  if (!hasProduction && legacyNode) {
    return (
      <span className={className} data-unilives-sharing-media="legacy-node" data-kind={kind} aria-hidden={decorative || !alt ? true : undefined}>
        {legacyNode}
      </span>
    );
  }

  return (
    <img
      src={visual.url}
      alt={decorative ? '' : alt}
      className={`${imgClassName} ${className}`.trim()}
      draggable={false}
      loading="lazy"
      decoding="async"
      aria-hidden={decorative || !alt ? true : undefined}
      data-unilives-sharing-media={visual.source}
      data-kind={kind}
      onError={(e) => {
        const img = e.currentTarget;
        if (img.dataset.fallbackApplied === '1') return;
        img.dataset.fallbackApplied = '1';
        img.src = '/brand/app-logo.png';
      }}
    />
  );
}
