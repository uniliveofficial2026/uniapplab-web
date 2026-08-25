/** Shared class helpers for UniLive’s design system — visual only. */

export const unilivesButtonBaseClass =
  'inline-flex items-center justify-center gap-2 font-bold unilives-focus-ring unilives-transition-fast disabled:opacity-50 disabled:pointer-events-none select-none touch-manipulation';

export const unilivesButtonVariantClass = {
  primary:
    'bg-[color:var(--color-unilives-primary)] text-white shadow-[var(--shadow-unilives-md)] hover:bg-[color:var(--color-unilives-primary-hover)] active:bg-[color:var(--color-unilives-primary-active)]',
  secondary:
    'bg-[color:var(--color-unilives-control-hover)] text-[color:var(--color-unilives-text)] border border-[color:var(--color-unilives-border)]',
  outline:
    'bg-transparent text-[color:var(--color-unilives-text)] border border-[color:var(--color-unilives-border-strong)]',
  ghost: 'bg-transparent text-[color:var(--color-unilives-text)] hover:bg-[color:var(--color-unilives-control-hover)]',
  destructive:
    'bg-[color:var(--color-unilives-error)] text-white hover:opacity-95',
  success: 'bg-[color:var(--color-unilives-success)] text-white hover:opacity-95',
  link: 'bg-transparent text-[color:var(--color-unilives-primary)] underline-offset-2 hover:underline p-0 h-auto shadow-none',
  icon: 'bg-[color:var(--color-unilives-control-hover)] text-[color:var(--color-unilives-text)] border border-[color:var(--color-unilives-border)] p-0',
} as const;

export type UniLivesButtonVariant = keyof typeof unilivesButtonVariantClass;

export const unilivesButtonSizeClass = {
  sm: 'rounded-[var(--radius-unilives-md)] px-3 py-2 text-xs min-h-[36px]',
  md: 'rounded-[var(--radius-unilives-lg)] px-4 py-3 text-sm min-h-[44px]',
  lg: 'rounded-[var(--radius-unilives-xl)] px-5 py-3.5 text-[15px] min-h-[48px]',
  icon: 'rounded-[var(--radius-unilives-lg)] h-11 w-11 min-h-[44px] min-w-[44px]',
} as const;

export type UniLivesButtonSize = keyof typeof unilivesButtonSizeClass;

export const unilivesInputClass =
  'w-full rounded-[var(--radius-unilives-lg)] border border-[color:var(--color-unilives-input-border)] bg-[color:var(--color-unilives-input-background)] px-4 py-3 text-base md:text-[length:var(--text-unilives-body)] font-medium text-[color:var(--color-unilives-text)] outline-none placeholder:text-[color:var(--color-unilives-input-placeholder)] focus:ring-2 focus:ring-[color:var(--color-unilives-focus)]/40 disabled:opacity-50';

export const unilivesCardClass =
  'rounded-[var(--radius-unilives-xl)] border border-[color:var(--color-unilives-border)] bg-[color:var(--color-unilives-surface)] text-[color:var(--color-unilives-text)] shadow-[var(--shadow-unilives-sm)]';

export const unilivesChipClass =
  'inline-flex items-center rounded-[var(--radius-unilives-pill)] border border-[color:var(--color-unilives-border)] bg-[color:var(--color-unilives-surface)] px-3 py-1.5 text-xs font-bold text-[color:var(--color-unilives-text)]';

export const unilivesBadgeClass =
  'inline-flex items-center rounded-[var(--radius-unilives-sm)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide';
