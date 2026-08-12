import React from 'react';
import { resolveStickerPlayMedia, type StickerPlayMedia } from '../../../lib/unilives-assets/stickerResolve';
import type { AssetResolveOptions } from '../../../lib/unilives-assets/types';
import { UniLivesStickerAnimation } from './UniLivesStickerAnimation';

type Props = {
  businessStickerId?: string | null;
  remoteMediaUrl?: string | null;
  legacyMediaUrl?: string | null;
  className?: string;
  resolveOptions?: AssetResolveOptions;
  onEnded: () => void;
  media?: StickerPlayMedia;
  renderSvga?: (args: { url: string; className: string; onEnded: () => void }) => React.ReactNode;
};

export function UniLivesStickerMediaHost({
  businessStickerId,
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
    resolveStickerPlayMedia({ businessStickerId, remoteMediaUrl, legacyMediaUrl, options: resolveOptions });
  return (
    <UniLivesStickerAnimation
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
