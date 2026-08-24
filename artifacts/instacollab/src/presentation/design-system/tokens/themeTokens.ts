/**
 * Typed UniLive’s design tokens. Values match existing CSS custom properties.
 * Changing tokens must not change wallet/identity/live business rules.
 */

export const THEME_TOKEN_VERSION = 4;

export type ThemeTokens = {
  version: number;
  color: {
    surface: { primary: string; secondary: string; inverse: string };
    text: { primary: string; muted: string; inverse: string };
    action: { primary: string; accent: string; destructive: string };
    live: string;
    gold: string;
    border: string;
    ring: string;
  };
  typography: {
    fontDisplay: string;
    fontBody: string;
    fontFallback: string;
    size: { xs: string; sm: string; md: string; lg: string; xl: string };
    weight: { regular: number; medium: number; semibold: number; bold: number; black: number };
    lineHeight: { tight: number; normal: number; relaxed: number };
  };
  space: { xs: string; sm: string; md: string; lg: string; xl: string; componentSm: string; componentMd: string };
  radius: { sm: string; md: string; lg: string; card: string; pill: string };
  border: { width: string };
  shadow: { sm: string; md: string; lg: string };
  opacity: { muted: number; disabled: number };
  zIndex: { base: number; overlay: number; modal: number; toast: number };
  motion: {
    duration: { fast: string; normal: string; slow: string; giftEnter: string };
    easing: { standard: string; enter: string; exit: string };
  };
  size: { controlSm: string; controlMd: string; controlLg: string };
  breakpoint: { phone: string; tablet: string; desktop: string };
  safeArea: { top: string; bottom: string; left: string; right: string };
  density: { compact: number; comfortable: number };
};

/** Default tokens — identical to current UniLive’s CSS aliases. */
export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  version: THEME_TOKEN_VERSION,
  color: {
    surface: {
      primary: 'var(--card)',
      secondary: 'var(--secondary)',
      inverse: 'var(--foreground)',
    },
    text: {
      primary: 'var(--foreground)',
      muted: 'var(--muted-foreground)',
      inverse: 'var(--background)',
    },
    action: {
      primary: 'var(--color-unilives-primary)',
      accent: 'var(--color-unilives-accent)',
      destructive: 'var(--destructive)',
    },
    live: 'var(--color-unilives-live)',
    gold: 'var(--color-unilives-gold)',
    border: 'var(--border)',
    ring: 'var(--color-unilives-ring)',
  },
  typography: {
    fontDisplay: 'var(--font-unilives-display)',
    fontBody: 'var(--font-unilives-body)',
    fontFallback: 'ui-sans-serif, system-ui, sans-serif',
    size: { xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.25rem', xl: '1.5rem' },
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700, black: 900 },
    lineHeight: { tight: 1.15, normal: 1.4, relaxed: 1.6 },
  },
  space: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    componentSm: '0.5rem',
    componentMd: '0.75rem',
  },
  radius: {
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    card: '1.25rem',
    pill: '9999px',
  },
  border: { width: '1px' },
  shadow: {
    sm: 'var(--shadow-unilives-sm, 0 1px 2px rgb(0 0 0 / 0.12))',
    md: 'var(--shadow-unilives-md, 0 8px 24px rgb(0 0 0 / 0.18))',
    lg: 'var(--shadow-unilives-lg, 0 16px 48px rgb(0 0 0 / 0.28))',
  },
  opacity: { muted: 0.7, disabled: 0.45 },
  zIndex: { base: 1, overlay: 40, modal: 50, toast: 9999 },
  motion: {
    duration: { fast: '120ms', normal: '220ms', slow: '360ms', giftEnter: '420ms' },
    easing: { standard: 'cubic-bezier(0.2, 0.8, 0.2, 1)', enter: 'ease-out', exit: 'ease-in' },
  },
  size: { controlSm: '2rem', controlMd: '2.75rem', controlLg: '3rem' },
  breakpoint: { phone: '430px', tablet: '768px', desktop: '1280px' },
  safeArea: {
    top: 'env(safe-area-inset-top)',
    bottom: 'env(safe-area-inset-bottom)',
    left: 'env(safe-area-inset-left)',
    right: 'env(safe-area-inset-right)',
  },
  density: { compact: 0.9, comfortable: 1 },
};

export const SEMANTIC_TOKEN_PATHS = [
  'color.surface.primary',
  'color.text.primary',
  'color.action.primary',
  'space.componentSm',
  'radius.card',
  'motion.duration.giftEnter',
] as const;

export function tokensToCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    '--ui-color-surface-primary': tokens.color.surface.primary,
    '--ui-color-text-primary': tokens.color.text.primary,
    '--ui-color-action-primary': tokens.color.action.primary,
    '--ui-space-component-sm': tokens.space.componentSm,
    '--ui-radius-card': tokens.radius.card,
    '--ui-motion-gift-enter': tokens.motion.duration.giftEnter,
    '--ui-font-display': tokens.typography.fontDisplay,
    '--ui-font-body': tokens.typography.fontBody,
  };
}

export function applyThemeTokens(tokens: ThemeTokens, root: HTMLElement | null = typeof document === 'undefined' ? null : document.documentElement): void {
  if (!root) return;
  const vars = tokensToCssVars(tokens);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.setAttribute('data-theme-version', String(tokens.version));
}
