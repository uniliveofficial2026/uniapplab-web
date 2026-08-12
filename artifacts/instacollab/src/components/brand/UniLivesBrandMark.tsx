import React from 'react';
import { APP_DISPLAY_NAME } from '../../lib/appBrand';
import {
  resolveBrandRegistryUrl,
  resolveBrandVariantUrl,
  shouldUseAnimatedBrand,
  type BrandMarkVariant,
  type BrandVisualContext,
} from '../../lib/unilives-assets';
import { AppNativeVideo } from '../common/AppNativeVideo';

export type UniLivesBrandMarkProps = {
  variant?: BrandMarkVariant;
  context?: BrandVisualContext;
  className?: string;
  imgClassName?: string;
  alt?: string;
  /** Prefer animated asset when production media exists and policy allows. */
  preferAnimated?: boolean;
};

/**
 * Static UniLive’s brand mark resolved through the asset registry.
 * Missing production files fall back to `/brand/app-logo.png`.
 * Preserves caller-provided className dimensions (no layout change).
 */
export function UniLivesBrandMark({
  variant = 'icon',
  context = 'header',
  className = 'w-8 h-8',
  imgClassName = 'object-contain w-full h-full',
  alt = `${APP_DISPLAY_NAME} logo`,
  preferAnimated = false,
}: UniLivesBrandMarkProps) {
  const useAnimated = preferAnimated && shouldUseAnimatedBrand(context);
  const src = useAnimated
    ? resolveBrandRegistryUrl('brand.logo.animated')
    : resolveBrandVariantUrl(variant);

  const isVideo = /\.(webm|mp4)(\?|$)/i.test(src) && !src.includes('/brand/app-logo');

  if (isVideo) {
    return (
      <AppNativeVideo
        src={src}
        className={`${imgClassName} ${className}`}
        autoPlay
        muted
        loop={context === 'loading'}
        controls={false}
        aria-label={alt}
      />
    );
  }

  return <img src={src} alt={alt} className={`${imgClassName} ${className}`} draggable={false} />;
}
