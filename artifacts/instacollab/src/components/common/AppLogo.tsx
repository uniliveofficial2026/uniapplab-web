import React from 'react';
import { Sparkles } from 'lucide-react';

interface AppLogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  showText?: boolean;
}

export function AppLogo({ className = "", iconClassName = "", textClassName = "", showText = true }: AppLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="shrink-0 flex items-center justify-center">
        <Sparkles className={`w-8 h-8 text-primary ${iconClassName}`} />
      </div>
      {showText && (
        <span className={`font-black tracking-tighter vibe-gradient-text logo-font font-serif italic ${textClassName}`}>
          InstaCollab
        </span>
      )}
    </div>
  );
}
