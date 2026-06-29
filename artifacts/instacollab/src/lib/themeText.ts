import type { CSSProperties } from 'react';

/**
 * Text colors chosen in create/edit tools are stored for compatibility but
 * always render with theme contrast: black in light mode, white in dark mode.
 */
export const THEME_ADAPTIVE_TEXT_CLASS = 'text-foreground editor-adaptive-text';

/** Wrapper for feed/modal/reel/story user captions and text posts. */
export const USER_CAPTION_PROSE_CLASS = 'post-caption-text text-foreground editor-adaptive-text';

/** Reel sidebar counts (likes, comments, shares) — always white on black video. */
export const REEL_STAT_LABEL_CLASS =
  'reel-stat-label text-[12px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]';

export const REEL_STAT_LABEL_STYLE: CSSProperties = {
  color: '#ffffff',
  WebkitTextFillColor: '#ffffff',
};

/** Stored on posts when overlay text should follow the app theme. */
export const THEME_OVERLAY_COLOR = 'theme';

const LEGACY_GRAY_TEXT_PATTERN =
  /text-(?:muted-foreground|gray|zinc|slate|neutral|stone)(?:\/[\d]+)?|text-white(?:\/[\d]+)?|text-black(?:\/[\d]+)?/;

/** True when a stored editor color would render as gray or fixed black/white. */
export function isLegacyEditorTextColor(color?: string | null): boolean {
  if (!color || typeof color !== 'string') return true;
  const trimmed = color.trim();
  if (!trimmed || trimmed === THEME_ADAPTIVE_TEXT_CLASS) return false;
  if (trimmed.includes('editor-adaptive-text')) return false;
  return LEGACY_GRAY_TEXT_PATTERN.test(trimmed) || !trimmed.includes('text-foreground');
}

/** Tailwind class for any editor-picked text color (feed, reels, stories, modals). */
export function resolveEditorTextColorClass(color?: string | null): string {
  if (isLegacyEditorTextColor(color)) return THEME_ADAPTIVE_TEXT_CLASS;
  return THEME_ADAPTIVE_TEXT_CLASS;
}

/** Persist theme-adaptive class when saving from create/edit tools. */
export function normalizeEditorTextColorForSave(_color?: string | null): string {
  return THEME_ADAPTIVE_TEXT_CLASS;
}

/** Inline style for text overlays on media (replaces hex from the color picker). */
export function themeAdaptiveTextStyle(): { color: string } {
  return { color: 'var(--foreground)' };
}

/** Persist overlay color when saving from create/edit tools. */
export function normalizeOverlayColorForSave(_color?: string | null): string {
  return THEME_OVERLAY_COLOR;
}

/** Inline overlay style at render time (ignores stored hex). */
export function resolveOverlayTextStyle(_stored?: string | null): { color: string } {
  return themeAdaptiveTextStyle();
}

/** @deprecated Use resolveEditorTextColorClass */
export function resolveCaptionColorClass(color?: string | null): string {
  return resolveEditorTextColorClass(color);
}

/** Normalize editor color fields on posts/reels/story segments at read time. */
export function normalizeEditorColorFields<
  T extends {
    color?: string | null;
    textColor?: string | null;
    textOverlayColor?: string | null;
  },
>(item: T): T {
  return {
    ...item,
    ...(item.color !== undefined
      ? { color: normalizeEditorTextColorForSave(item.color) }
      : {}),
    ...(item.textColor !== undefined
      ? { textColor: normalizeEditorTextColorForSave(item.textColor) }
      : {}),
    ...(item.textOverlayColor !== undefined && item.textOverlayColor !== null
      ? { textOverlayColor: normalizeOverlayColorForSave(item.textOverlayColor) }
      : {}),
  };
}
