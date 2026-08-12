import React from 'react';
import { UniLivesSeatInteractionThumbnail } from './UniLivesSeatInteractionThumbnail';
import type { AssetResolveOptions } from '../../../lib/unilives-assets/types';

type Props = React.ComponentProps<typeof UniLivesSeatInteractionThumbnail> & { className?: string };

export function UniLivesSeatInteractionPreview({ className, ...rest }: Props) {
  return (
    <div className={className} data-unilives-seat-interaction-preview="">
      <UniLivesSeatInteractionThumbnail {...rest} imgClassName={rest.imgClassName ?? 'h-16 w-16 object-contain'} />
    </div>
  );
}
