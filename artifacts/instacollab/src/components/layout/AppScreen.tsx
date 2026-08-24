import React, { type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

type AppScreenProps = {
  children: ReactNode;
  className?: string;
  /**
   * Immersive: background/media go edge-to-edge; chrome should use safe insets itself.
   * Default pads left/right for landscape notch / fold safe areas.
   */
  immersive?: boolean;
  style?: CSSProperties;
  as?: 'div' | 'section' | 'main';
} & Omit<HTMLAttributes<HTMLElement>, 'children' | 'className' | 'style'>;

/**
 * Standard screen frame for the real app:
 * - fills the shell (fullscreen within the viewport)
 * - edge-to-edge background when immersive
 * - optional horizontal safe insets for interactive content
 */
export function AppScreen({
  children,
  className = '',
  immersive = false,
  style,
  as: Tag = 'div',
  ...rest
}: AppScreenProps) {
  return (
    <Tag
      className={`app-screen ${immersive ? 'app-screen--immersive' : ''} ${className}`.trim()}
      style={style}
      data-app-screen={immersive ? 'immersive' : 'safe'}
      {...rest}
    >
      {children}
    </Tag>
  );
}
