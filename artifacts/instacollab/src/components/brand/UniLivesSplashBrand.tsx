import React, { useEffect, useState } from 'react';
import { APP_DISPLAY_NAME } from '../../lib/appBrand';
import { resolveBrandContextUrl, shouldUseAnimatedBrand } from '../../lib/unilives-assets';
import { useDB } from '../../lib/useDB';
import { AppNativeVideo } from '../common/AppNativeVideo';
import { UniLivesAnimatedLogo } from './UniLivesAnimatedLogo';

type Props = {
  className?: string;
  imgClassName?: string;
  alt?: string;
};

/**
 * Splash-only brand artwork — never the app logo icon.
 * Precedence: uploaded splashArtworkUrl → registry brand.splash.main.
 */
export function UniLivesSplashBrand({
  className,
  imgClassName = 'pointer-events-none h-full w-full object-contain p-2',
  alt = APP_DISPLAY_NAME,
}: Props) {
  const db = useDB();
  const [, tick] = useState(0);

  useEffect(() => {
    const refresh = () => tick((n) => n + 1);
    window.addEventListener('splash-artwork:updated', refresh);
    return () => window.removeEventListener('splash-artwork:updated', refresh);
  }, []);

  void tick;
  void db.settings.splashArtworkUrl;
  void db.settings.splashArtworkMediaType;

  const customUrl =
    typeof db.settings.splashArtworkUrl === 'string' && db.settings.splashArtworkUrl.trim()
      ? db.settings.splashArtworkUrl.trim()
      : null;
  const isVideo = db.settings.splashArtworkMediaType === 'video' && Boolean(customUrl);

  if (customUrl) {
    return (
      <div className={className}>
        {isVideo ? (
          <AppNativeVideo
            src={customUrl}
            className={imgClassName}
            autoPlay
            muted
            loop
            aria-label={alt}
          />
        ) : (
          <img src={customUrl} alt={alt} className={imgClassName} draggable={false} />
        )}
      </div>
    );
  }

  if (shouldUseAnimatedBrand('splash')) {
    return (
      <div className={className}>
        <UniLivesAnimatedLogo context="splash" className={imgClassName} alt={alt} />
      </div>
    );
  }

  const src = resolveBrandContextUrl('splash');
  return (
    <div className={className}>
      <img src={src} alt={alt} className={imgClassName} draggable={false} />
    </div>
  );
}
