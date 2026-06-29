import React from 'react';
import { Sparkles } from 'lucide-react';

interface AppLogoProps {
  className?: string; // Additional classes for the container
  iconClassName?: string; // Additional classes for the icon specifically
  textClassName?: string; // Additional classes for the text specifically
  showText?: boolean;
}

export function AppLogo({ className = "", iconClassName = "", textClassName = "", showText = true }: AppLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* You can change this element to an <img src="/logo.svg" /> or an animated SVG if preferred */}
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
