import React from 'react';
import {
  resolveGiftPlayMedia,
  type GiftPlayMedia,
} from '../../../lib/unilives-assets/giftResolve';
import type { AssetResolveOptions } from '../../../lib/unilives-assets/types';
import { UniLivesGiftAnimation } from './UniLivesGiftAnimation';

type Props = {
  businessGiftId?: string | null;
  legacySvgaUrl?: string | null;
  legacyVideoUrl?: string | null;
  className?: string;
  resolveOptions?: AssetResolveOptions;
  onEnded: () => void;
  media?: GiftPlayMedia;
  renderSvga?: (args: { url: string; className: string; onEnded: () => void }) => React.ReactNode;
};

/**
 * Resolves play media from business gift ID, then hosts WebM/static (and SVGA via renderSvga).
 * No wallet or transaction logic.
 */
export function UniLivesGiftMediaHost({
  businessGiftId,
  legacySvgaUrl,
  legacyVideoUrl,
  className,
  resolveOptions,
  onEnded,
  media: mediaProp,
  renderSvga,
}: Props) {
  const media =
    mediaProp ??
    resolveGiftPlayMedia({
      businessGiftId,
      legacySvgaUrl,
      legacyVideoUrl,
      options: resolveOptions,
    });

  return (
    <UniLivesGiftAnimation
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
