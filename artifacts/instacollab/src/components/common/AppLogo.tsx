import React from 'react';
import { Sparkles } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { APP_DISPLAY_NAME } from '../../lib/appBrand';
import { nativeVideoControlGuardProps } from '../../lib/nativeVideoControls';

interface AppLogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  showText?: boolean;
}

export function AppLogo({
  className = '',
  iconClassName = '',
  textClassName = '',
  showText = true,
}: AppLogoProps) {
  const db = useDB();
  const logoUrl = (db.settings.appLogoUrl as string | undefined) ?? null;
  const isVideo = db.settings.appLogoMediaType === 'video' && Boolean(logoUrl);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="shrink-0 flex items-center justify-center overflow-hidden rounded-xl">
        {logoUrl ? (
          isVideo ? (
            <video
              src={logoUrl}
              className={`object-cover rounded-xl ${iconClassName || 'w-8 h-8'}`}
              autoPlay
              muted
              loop
              playsInline
              aria-label={`${APP_DISPLAY_NAME} logo`}
              {...nativeVideoControlGuardProps()}
            />
          ) : (
            <img
              src={logoUrl}
              alt={`${APP_DISPLAY_NAME} logo`}
              className={`object-contain ${iconClassName || 'w-8 h-8'}`}
            />
          )
        ) : (
          <Sparkles className={`w-8 h-8 text-primary ${iconClassName}`} />
        )}
      </div>
      {showText && (
        <span
          className={`font-black tracking-tighter vibe-gradient-text logo-font font-serif italic ${textClassName}`}
        >
          {APP_DISPLAY_NAME}
        </span>
      )}
    </div>
  );
}
