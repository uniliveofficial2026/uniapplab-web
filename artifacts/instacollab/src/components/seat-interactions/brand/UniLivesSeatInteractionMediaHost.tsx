import React from 'react';
import {
  resolveSeatInteractionPlayMedia,
  type SeatInteractionPlayMedia,
} from '../../../lib/unilives-assets/seatInteractionResolve';
import type { AssetResolveOptions } from '../../../lib/unilives-assets/types';
import { UniLivesSeatInteractionAnimation } from './UniLivesSeatInteractionAnimation';

type Props = {
  businessInteractionId?: string | null;
  remoteMediaUrl?: string | null;
  legacyMediaUrl?: string | null;
  className?: string;
  resolveOptions?: AssetResolveOptions;
  onEnded: () => void;
  media?: SeatInteractionPlayMedia;
  renderSvga?: (args: { url: string; className: string; onEnded: () => void }) => React.ReactNode;
};

/** Visual host only — source/target seats and permissions come from parent props elsewhere. */
export function UniLivesSeatInteractionMediaHost({
  businessInteractionId,
  remoteMediaUrl,
  legacyMediaUrl,
  className,
  resolveOptions,
  onEnded,
  media: mediaProp,
  renderSvga,
}: Props) {
  const media =
    mediaProp ??
    resolveSeatInteractionPlayMedia({
      businessInteractionId,
      remoteMediaUrl,
      legacyMediaUrl,
      options: resolveOptions,
    });
  return (
    <UniLivesSeatInteractionAnimation
      svgaUrl={media.svgaUrl}
      videoUrl={media.videoUrl}
      staticUrl={media.staticUrl}
      preferStatic={media.preferStatic}
      className={className}
      onEnded={onEnded}
      renderSvga={renderSvga}
    />
  );
}
