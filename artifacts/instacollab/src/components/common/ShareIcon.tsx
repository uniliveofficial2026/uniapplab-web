import React from 'react';
import { Send } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ShareIconSize = 'xs' | 'sm' | 'md' | 'feed' | 'lg' | 'xl' | 'room';

const SIZE_CLASS: Record<ShareIconSize, string> = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  feed: 'w-[26px] h-[26px]',
  lg: 'w-7 h-7',
  xl: 'w-7 h-7 sm:w-8 sm:h-8',
  room: 'w-[15px] h-[15px]',
};

export type ShareIconTone = 'default' | 'light' | 'inherit';

const TONE_CLASS: Record<ShareIconTone, string> = {
  default: 'stroke-foreground group-hover:stroke-primary transition-colors',
  light: 'stroke-[2px] stroke-white',
  inherit: 'stroke-current transition-colors',
};

type ShareIconProps = {
  size?: ShareIconSize;
  tone?: ShareIconTone;
  className?: string;
  strokeWidth?: number;
};

/** Canonical paper-plane share icon used across feed, K-Star, and party rooms. */
export function ShareIcon({
  size = 'feed',
  tone = 'default',
  className = '',
  strokeWidth,
}: ShareIconProps) {
  return (
    <Send
      aria-hidden
      strokeWidth={strokeWidth}
      className={cn(
        SIZE_CLASS[size],
        tone !== 'inherit' ? TONE_CLASS[tone] : undefined,
        size === 'feed' && '-mt-1 ml-1',
        size === 'lg' && tone === 'light' && '-ml-1 mt-1',
        className,
      )}
    />
  );
}
