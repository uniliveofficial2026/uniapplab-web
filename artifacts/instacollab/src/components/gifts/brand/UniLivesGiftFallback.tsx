import React from 'react';
import { UNILIVES_NEUTRAL_GIFT_FALLBACK } from '../../../lib/unilives-assets/giftResolve';

type Props = {
  className?: string;
  alt?: string;
  src?: string;
};

/** Neutral / missing-media gift image. */
export function UniLivesGiftFallback({
  className = 'h-8 w-8 object-contain opacity-80',
  alt = '',
  src = UNILIVES_NEUTRAL_GIFT_FALLBACK,
}: Props) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      draggable={false}
      data-unilives-gift-fallback=""
    />
  );
}
