import React from 'react';
import { resolveSeatInteractionThumbnailVisual } from '../../../lib/unilives-assets/seatInteractionResolve';
import type { AssetResolveOptions } from '../../../lib/unilives-assets/types';

type Props = {
  businessInteractionId?: string | null;
  legacyIcon?: string | null;
  remoteIconOverride?: string | null;
  className?: string;
  imgClassName?: string;
  alt?: string;
  resolveOptions?: AssetResolveOptions;
};

export function UniLivesSeatInteractionThumbnail({
  businessInteractionId,
  legacyIcon,
  remoteIconOverride,
  className = '',
  imgClassName = 'h-10 w-10 object-contain',
  alt = '',
  resolveOptions,
}: Props) {
  const visual = resolveSeatInteractionThumbnailVisual({
    businessInteractionId,
    legacyIcon,
    remoteIconOverride,
    options: resolveOptions,
  });

  if (visual.kind === 'emoji') {
    return (
      <span
        className={className || 'text-xl leading-none'}
        data-unilives-seat-interaction-thumb=""
        data-business-interaction-id={businessInteractionId ?? undefined}
        data-visual-source={visual.source}
        aria-hidden={alt ? undefined : true}
      >
        {visual.emoji}
      </span>
    );
  }

  return (
    <img
      src={visual.url}
      alt={alt}
      className={imgClassName}
      draggable={false}
      loading="lazy"
      decoding="async"
      data-unilives-seat-interaction-thumb=""
      data-business-interaction-id={businessInteractionId ?? undefined}
      data-visual-source={visual.source}
      data-canonical-asset-id={visual.canonicalAssetId}
      onError={(event) => {
        const img = event.currentTarget;
        if (img.dataset.fallbackApplied === '1') return;
        img.dataset.fallbackApplied = '1';
        img.src = '/brand/app-logo.png';
      }}
    />
  );
}
