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

/** Marks surfaces wired to keyboard SSOT (including file pickers in Creator flows). */
export const keyboardSurfaceDataAttr = { 'data-keyboard-ssot': 'shared' } as const;

/** Wallet / payout bordered fields — 16px on mobile to avoid iOS focus zoom. */
export const walletFieldInputClassName =
  'w-full bg-secondary/35 border border-border rounded-xl p-2.5 font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/45 text-base md:text-xs';

/** Large amount entry rows in wallet tabs. */
export const walletAmountInputClassName =
  'bg-transparent border-0 font-black text-foreground focus:ring-0 focus:outline-none p-0 min-w-0 flex-1 text-base sm:text-2xl';

export const walletModalOverlayClassName =
  'fixed inset-0 z-[3000] flex items-end sm:items-center justify-center p-4 pb-[max(1rem,var(--app-composer-bottom-inset))]';

export const walletModalPanelClassName =
  `w-full max-w-md bg-card border border-border rounded-[32px] shadow-2xl relative z-10 p-6 flex flex-col gap-5 animate-in zoom-in-95 duration-200 overflow-y-auto overscroll-contain ${keyboardAwareSheetTallClassName}`;
