import React from 'react';
import { UNILIVES_NEUTRAL_IDENTITY_FALLBACK } from '../../../lib/unilives-assets/identityResolve';

export function UniLivesIdentityFallback({
  className = 'h-3.5 w-3.5 object-contain opacity-80',
  alt = '',
  src = UNILIVES_NEUTRAL_IDENTITY_FALLBACK,
}: { className?: string; alt?: string; src?: string }) {
  return <img src={src} alt={alt} className={className} draggable={false} data-unilives-identity-fallback="" />;
}
