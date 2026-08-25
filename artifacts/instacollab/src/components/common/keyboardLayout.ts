/**
 * Keyboard / viewport SSOT class tokens.
 * Composers and sheets must consume these — do not copy-paste inset math.
 */
export const keyboardComposerClassName = 'pb-composer shrink-0';

/** iOS: 16px minimum on focus fields to avoid unexpected zoom. */
export const keyboardInputClassName =
  'text-base md:text-[15px] bg-transparent border-none outline-none font-medium';

/**
 * Bottom sheets/modals: derive max height from visual viewport, not raw 100vh.
 * Prevents double-subtraction when keyboard is open.
 */
export const keyboardAwareSheetClassName =
  'max-h-[min(65dvh,calc(var(--app-vv-height,100dvh)*0.85))]';

export const keyboardAwareSheetTallClassName =
  'max-h-[min(85dvh,calc(var(--app-vv-height,100dvh)*0.92))]';
