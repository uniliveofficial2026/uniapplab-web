import React from 'react';
import { UniLivesGiftThumbnail } from './UniLivesGiftThumbnail';
import type { AssetResolveOptions } from '../../../lib/unilives-assets/types';

type Props = {
  businessGiftId?: string | null;
  legacyIcon?: string | null;
  remoteIconOverride?: string | null;
  className?: string;
  imgClassName?: string;
  alt?: string;
  resolveOptions?: AssetResolveOptions;
};

/** Larger selected-gift preview — same resolution path as thumbnail. */
export function UniLivesGiftPreview({
  businessGiftId,
  legacyIcon,
  remoteIconOverride,
  className = '',
  imgClassName = 'h-16 w-16 object-contain',
  alt = '',
  resolveOptions,
}: Props) {
  return (
    <div className={className} data-unilives-gift-preview="">
      <UniLivesGiftThumbnail
        businessGiftId={businessGiftId}
        legacyIcon={legacyIcon}
        remoteIconOverride={remoteIconOverride}
        imgClassName={imgClassName}
        alt={alt}
        resolveOptions={resolveOptions}
      />
    </div>
  );
}
