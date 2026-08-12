import React from 'react';
import { UniLivesStickerThumbnail } from './UniLivesStickerThumbnail';
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

export function UniLivesStickerPreview(props: Props) {
  return (
    <div className={props.className} data-unilives-sticker-preview="">
      <UniLivesStickerThumbnail {...props} imgClassName={props.imgClassName ?? 'h-16 w-16 object-contain'} />
    </div>
  );
}
