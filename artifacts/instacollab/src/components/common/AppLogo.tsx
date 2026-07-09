import React from 'react';
import { APP_DISPLAY_NAME } from '../../lib/appBrand';
import { AppBrandIcon } from './AppBrandIcon';

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
  return (
    <div className={`flex items-center gap-2 overflow-visible ${className}`}>
      <div className="shrink-0 flex items-center justify-center overflow-hidden rounded-xl">
        <AppBrandIcon className={iconClassName || 'w-8 h-8'} imageFit="contain" />
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
