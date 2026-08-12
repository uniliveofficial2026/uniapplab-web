import React from 'react';
import { resolveStickerThumbnailVisual } from '../../../lib/unilives-assets/stickerResolve';
import type { AssetResolveOptions } from '../../../lib/unilives-assets/types';

type Props = {
  businessStickerId?: string | null;
  legacyIcon?: string | null;
  remoteIconOverride?: string | null;
  className?: string;
  imgClassName?: string;
  alt?: string;
  resolveOptions?: AssetResolveOptions;
};

/** Sticker tray thumbnail — registry → remote → legacy emoji → neutral. */
export function UniLivesStickerThumbnail({
  businessStickerId,
  legacyIcon,
  remoteIconOverride,
  className = '',
  imgClassName = 'h-10 w-10 object-contain',
  alt = '',
  resolveOptions,
}: Props) {
  const visual = resolveStickerThumbnailVisual({
    businessStickerId,
    legacyIcon,
    remoteIconOverride,
    options: resolveOptions,
  });

  if (visual.kind === 'emoji') {
    return (
      <span
        className={className || 'text-xl leading-none'}
        data-unilives-sticker-thumb=""
        data-business-sticker-id={businessStickerId ?? undefined}
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
      data-unilives-sticker-thumb=""
      data-business-sticker-id={businessStickerId ?? undefined}
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
