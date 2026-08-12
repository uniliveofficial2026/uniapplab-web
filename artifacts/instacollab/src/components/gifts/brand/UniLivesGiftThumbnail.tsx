import React from 'react';
import { resolveGiftThumbnailVisual } from '../../../lib/unilives-assets/giftResolve';
import type { AssetResolveOptions } from '../../../lib/unilives-assets/types';

type Props = {
  /** Authoritative business gift ID — never a visual asset ID. */
  businessGiftId?: string | null;
  /** Catalog icon (emoji or existing media URL). */
  legacyIcon?: string | null;
  /** Admin / remote override when already validated by parent. */
  remoteIconOverride?: string | null;
  className?: string;
  imgClassName?: string;
  alt?: string;
  resolveOptions?: AssetResolveOptions;
};

/**
 * Gift tray / picker thumbnail. Resolves via registry → legacy → neutral.
 * Temporary emoji is allowed only while production thumbnails are missing.
 */
export function UniLivesGiftThumbnail({
  businessGiftId,
  legacyIcon,
  remoteIconOverride,
  className = '',
  imgClassName = 'h-8 w-8 object-contain',
  alt = '',
  resolveOptions,
}: Props) {
  const visual = resolveGiftThumbnailVisual({
    businessGiftId,
    legacyIcon,
    remoteIconOverride,
    options: resolveOptions,
  });

  if (visual.kind === 'emoji') {
    return (
      <span
        className={className}
        data-unilives-gift-thumb=""
        data-business-gift-id={businessGiftId ?? undefined}
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
      data-unilives-gift-thumb=""
      data-business-gift-id={businessGiftId ?? undefined}
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
