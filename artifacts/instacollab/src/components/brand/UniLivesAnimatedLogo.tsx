import React from 'react';
import { APP_DISPLAY_NAME } from '../../lib/appBrand';
import {
  resolveBrandRegistryUrl,
  shouldUseAnimatedBrand,
  type BrandVisualContext,
} from '../../lib/unilives-assets';
import { AppNativeVideo } from '../common/AppNativeVideo';

type Props = {
  context?: Extract<BrandVisualContext, 'splash' | 'loading' | 'header'>;
  className?: string;
  alt?: string;
};

/**
 * Animated UniLive’s logo when a production animated asset exists.
 * Otherwise renders the known-good static fallback. Never autoplays audio.
 */
export function UniLivesAnimatedLogo({
  context = 'splash',
  className = 'w-full h-full object-contain',
  alt = `${APP_DISPLAY_NAME} logo`,
}: Props) {
  const animatedAllowed = shouldUseAnimatedBrand(context);
  const src = animatedAllowed
    ? resolveBrandRegistryUrl('brand.logo.animated')
    : resolveBrandRegistryUrl(
        context === 'loading' ? 'brand.loading.mascot' : 'brand.logo.primary',
      );

  const isVideo = animatedAllowed && /\.(webm|mp4)(\?|$)/i.test(src);

  if (isVideo) {
    return (
      <AppNativeVideo
        src={src}
        className={className}
        autoPlay
        muted
        loop={context === 'loading'}
        controls={false}
        aria-label={alt}
      />
    );
  }

  return <img src={src} alt={alt} className={className} draggable={false} />;
}
