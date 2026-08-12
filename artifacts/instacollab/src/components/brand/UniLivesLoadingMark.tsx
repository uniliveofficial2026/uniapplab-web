import React from 'react';
import { APP_DISPLAY_NAME } from '../../lib/appBrand';
import { resolveBrandContextUrl, shouldUseAnimatedBrand } from '../../lib/unilives-assets';
import { UniLivesAnimatedLogo } from './UniLivesAnimatedLogo';

type Props = {
  className?: string;
  imgClassName?: string;
  alt?: string;
};

/** Loading-context brand mark (short loop when production animation exists). */
export function UniLivesLoadingMark({
  className,
  imgClassName = 'object-contain w-full h-full',
  alt = `${APP_DISPLAY_NAME} loading`,
}: Props) {
  if (shouldUseAnimatedBrand('loading')) {
    return (
      <div className={className}>
        <UniLivesAnimatedLogo context="loading" className={imgClassName} alt={alt} />
      </div>
    );
  }

  const src = resolveBrandContextUrl('loading');
  return (
    <div className={className}>
      <img src={src} alt={alt} className={imgClassName} draggable={false} />
    </div>
  );
}
