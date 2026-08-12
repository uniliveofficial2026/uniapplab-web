import React, { useEffect, useState } from 'react';
import {
  APP_BRAND_FALLBACK_ICON,
  APP_DISPLAY_NAME,
  resolveAppBrandFallbackIcon,
} from '../../lib/appBrand';
import { readAppBrandSnapshot } from '../../lib/appBrandRuntime';
import { useDB } from '../../lib/useDB';
import { AppNativeVideo } from './AppNativeVideo';

type AppBrandIconProps = {
  className?: string;
  roundedClassName?: string;
  imageFit?: 'contain' | 'cover';
};

/**
 * App logo from platform backend, then UniLive’s registry, then known-good fallback.
 * Used anywhere the product icon appears: shell, PWA prompt, splash, etc.
 * Caller className controls size — no layout changes.
 */
export function AppBrandIcon({
  className = 'w-8 h-8',
  roundedClassName = 'rounded-xl',
  imageFit = 'contain',
}: AppBrandIconProps) {
  const db = useDB();
  void db.settings.appLogoUrl;
  void db.settings.appLogoMediaType;
  const [, setBrandTick] = useState(0);

  useEffect(() => {
    const refresh = () => setBrandTick((t) => t + 1);
    window.addEventListener('app-brand:updated', refresh);
    window.addEventListener('platform-app-brand-updated', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('app-brand:updated', refresh);
      window.removeEventListener('platform-app-brand-updated', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const brand = readAppBrandSnapshot();
  const registryFallback = resolveAppBrandFallbackIcon();
  const rawLogoUrl = brand.logoUrl;
  const isRemoteCustom = Boolean(
    rawLogoUrl &&
      rawLogoUrl !== APP_BRAND_FALLBACK_ICON &&
      rawLogoUrl !== registryFallback,
  );
  const logoUrl = isRemoteCustom
    ? rawLogoUrl
    : rawLogoUrl === APP_BRAND_FALLBACK_ICON || !rawLogoUrl
      ? registryFallback
      : rawLogoUrl;
  const isVideo = brand.mediaType === 'video' && Boolean(logoUrl) && isRemoteCustom;
  const fitClass = imageFit === 'cover' ? 'object-cover' : 'object-contain';

  if (logoUrl && isVideo) {
    return (
      <AppNativeVideo
        src={logoUrl}
        className={`${fitClass} ${roundedClassName} ${className}`}
        autoPlay
        muted
        loop
        controls={false}
        aria-label={`${APP_DISPLAY_NAME} logo`}
      />
    );
  }

  return (
    <img
      src={logoUrl ?? registryFallback}
      alt={`${APP_DISPLAY_NAME} logo`}
      className={`${fitClass} ${roundedClassName} ${className}`}
      draggable={false}
    />
  );
}
