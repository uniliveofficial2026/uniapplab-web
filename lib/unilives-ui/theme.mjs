/**
 * UniLive UI Kit — reference theme tokens.
 * Defaults mirror production UniLive’s appearance; extracting for reuse must NOT
 * change the reference app’s rendered visuals (uiUxChanged = false).
 */

export const uniliveReferenceTheme = Object.freeze({
  id: 'unilives-reference',
  colors: Object.freeze({
    bg: '#0B0B0F',
    bgElevated: '#14141A',
    surface: '#1C1C24',
    border: '#2A2A36',
    text: '#F5F5F7',
    textMuted: '#A1A1AA',
    primary: '#FF2D55',
    primaryHover: '#FF4D6D',
    secondary: '#5E5CE6',
    success: '#30D158',
    warning: '#FFD60A',
    danger: '#FF453A',
    focus: '#64D2FF',
    overlay: 'rgba(0,0,0,0.55)',
  }),
  typography: Object.freeze({
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    sizes: Object.freeze({ xs: 12, sm: 14, md: 16, lg: 18, xl: 22, '2xl': 28 }),
    weights: Object.freeze({ regular: 400, medium: 500, semibold: 600, bold: 700 }),
    lineHeights: Object.freeze({ tight: 1.2, normal: 1.45, loose: 1.6 }),
  }),
  spacing: Object.freeze({ 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 }),
  radius: Object.freeze({ none: 0, sm: 6, md: 10, lg: 14, xl: 20, full: 9999 }),
  shadow: Object.freeze({
    sm: '0 1px 2px rgba(0,0,0,0.25)',
    md: '0 4px 12px rgba(0,0,0,0.35)',
    lg: '0 12px 32px rgba(0,0,0,0.45)',
  }),
  motion: Object.freeze({
    fast: '120ms',
    normal: '200ms',
    slow: '320ms',
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  }),
  zIndex: Object.freeze({ base: 0, dropdown: 20, sticky: 40, modal: 60, toast: 80, overlay: 100 }),
  safeArea: Object.freeze({
    top: 'env(safe-area-inset-top, 0px)',
    right: 'env(safe-area-inset-right, 0px)',
    bottom: 'env(safe-area-inset-bottom, 0px)',
    left: 'env(safe-area-inset-left, 0px)',
  }),
  breakpoints: Object.freeze({ mobile: 390, tablet: 768, desktop: 1280 }),
});

/** @type {typeof uniliveReferenceTheme | null} */
let activeTheme = uniliveReferenceTheme;

export function getTheme() {
  return activeTheme || uniliveReferenceTheme;
}

/**
 * @param {Partial<typeof uniliveReferenceTheme> | null} theme
 */
export function setTheme(theme) {
  if (!theme) {
    activeTheme = uniliveReferenceTheme;
    return activeTheme;
  }
  activeTheme = {
    ...uniliveReferenceTheme,
    ...theme,
    colors: { ...uniliveReferenceTheme.colors, ...(theme.colors || {}) },
    typography: { ...uniliveReferenceTheme.typography, ...(theme.typography || {}) },
    spacing: { ...uniliveReferenceTheme.spacing, ...(theme.spacing || {}) },
    radius: { ...uniliveReferenceTheme.radius, ...(theme.radius || {}) },
    shadow: { ...uniliveReferenceTheme.shadow, ...(theme.shadow || {}) },
    motion: { ...uniliveReferenceTheme.motion, ...(theme.motion || {}) },
    zIndex: { ...uniliveReferenceTheme.zIndex, ...(theme.zIndex || {}) },
    safeArea: { ...uniliveReferenceTheme.safeArea, ...(theme.safeArea || {}) },
    breakpoints: { ...uniliveReferenceTheme.breakpoints, ...(theme.breakpoints || {}) },
  };
  return activeTheme;
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * CSS custom properties for the active theme (provider-neutral).
 */
export function themeToCssVars(theme = getTheme()) {
  /** @type {Record<string, string>} */
  const vars = {};
  for (const [k, v] of Object.entries(theme.colors)) vars[`--ul-color-${k}`] = String(v);
  for (const [k, v] of Object.entries(theme.spacing)) vars[`--ul-space-${k}`] = `${v}px`;
  for (const [k, v] of Object.entries(theme.radius)) vars[`--ul-radius-${k}`] = typeof v === 'number' ? `${v}px` : String(v);
  vars['--ul-font-family'] = theme.typography.fontFamily;
  return vars;
}
