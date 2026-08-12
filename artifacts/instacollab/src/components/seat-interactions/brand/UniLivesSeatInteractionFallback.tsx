import React from 'react';
import { UNILIVES_NEUTRAL_INTERACTION_FALLBACK } from '../../../lib/unilives-assets/seatInteractionResolve';

type Props = { className?: string; alt?: string; src?: string };

export function UniLivesSeatInteractionFallback({
  className = 'h-10 w-10 object-contain opacity-80',
  alt = '',
  src = UNILIVES_NEUTRAL_INTERACTION_FALLBACK,
}: Props) {
  return <img src={src} alt={alt} className={className} draggable={false} data-unilives-seat-interaction-fallback="" />;
}
