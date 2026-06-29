import { useState, useEffect } from 'react';

export type OptionsMenuTone = 'default' | 'danger';
/** surface = light/dark app chrome; overlay = dark glass on reels/video UI */
export type OptionsMenuTheme = 'surface' | 'overlay';

const itemBase =
  'w-full text-left px-3 py-3 rounded-lg text-sm font-medium cursor-pointer pointer-events-auto select-none transition-all duration-150 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

export function useOptionsMenuHover(menuOpen: boolean) {
  const [hoveredMenuItem, setHoveredMenuItem] = useState<string | null>(null);
  useEffect(() => {
    if (!menuOpen) setHoveredMenuItem(null);
  }, [menuOpen]);
  return { hoveredMenuItem, setHoveredMenuItem };
}

export function getOptionsMenuItemClass(
  id: string,
  tone: OptionsMenuTone,
  hoveredMenuItem: string | null,
  theme: OptionsMenuTheme = 'surface'
): string {
  const isActive = hoveredMenuItem === id;

  if (theme === 'overlay') {
    if (isActive) {
      return tone === 'danger'
        ? `${itemBase} bg-red-500/40 text-red-200 font-semibold border-red-400/50 shadow-md scale-[1.02]`
        : `${itemBase} bg-white/25 text-white font-semibold border-white/35 shadow-md scale-[1.02]`;
    }
    return tone === 'danger'
      ? `${itemBase} border-transparent text-red-400 active:bg-red-500/35 active:font-semibold active:border-red-400/50 active:shadow-md active:scale-[1.02]`
      : `${itemBase} border-transparent text-white active:bg-white/20 active:font-semibold active:border-white/25 active:shadow-md active:scale-[1.02]`;
  }

  if (isActive) {
    return tone === 'danger'
      ? `${itemBase} bg-red-100 dark:bg-red-950/90 text-red-700 dark:text-red-300 font-semibold border-red-400/50 dark:border-red-500/50 shadow-md scale-[1.02]`
      : `${itemBase} bg-secondary text-foreground font-semibold border-border shadow-md scale-[1.02]`;
  }
  return tone === 'danger'
    ? `${itemBase} border-transparent text-red-600 dark:text-red-400 active:bg-red-100 dark:active:bg-red-950/90 active:font-semibold active:border-red-400/50 active:shadow-md active:scale-[1.02]`
    : `${itemBase} border-transparent text-foreground active:bg-secondary active:font-semibold active:border-border active:shadow-md active:scale-[1.02]`;
}

export function optionsMenuItemPointerHandlers(
  id: string,
  setHoveredMenuItem: (id: string | null) => void
) {
  return {
    onMouseEnter: () => setHoveredMenuItem(id),
    onMouseLeave: () => setHoveredMenuItem(null),
    onFocus: () => setHoveredMenuItem(id),
    onBlur: () => setHoveredMenuItem(null),
  };
}
