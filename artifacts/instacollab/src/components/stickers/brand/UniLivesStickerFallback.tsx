import React from 'react';
import { UNILIVES_NEUTRAL_STICKER_FALLBACK } from '../../../lib/unilives-assets/stickerResolve';

type Props = { className?: string; alt?: string; src?: string };

export function UniLivesStickerFallback({
  className = 'h-10 w-10 object-contain opacity-80',
  alt = '',
  src = UNILIVES_NEUTRAL_STICKER_FALLBACK,
}: Props) {
  return <img src={src} alt={alt} className={className} draggable={false} data-unilives-sticker-fallback="" />;
}
