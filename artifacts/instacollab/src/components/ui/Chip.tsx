import React from 'react';
import { unilivesBadgeClass, unilivesChipClass } from './classes';

type ChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
};

/** Chip / filter pill chrome. Parent owns selection logic. */
export function UniLivesChip({
  selected = false,
  className = '',
  children,
  type = 'button',
  ...rest
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={`${unilivesChipClass} unilives-focus-ring unilives-transition-fast ${
        selected
          ? 'border-[color:var(--color-unilives-primary)] bg-[color:var(--color-unilives-primary)] text-white'
          : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'default' | 'live' | 'success' | 'warning' | 'error' | 'gold';
};

/** Badge container chrome only — not VIP/level media. */
export function UniLivesBadge({
  tone = 'default',
  className = '',
  children,
  ...rest
}: BadgeProps) {
  const toneClass =
    tone === 'live'
      ? 'bg-[color:var(--color-unilives-live)] text-white'
      : tone === 'success'
        ? 'bg-[color:var(--color-unilives-success)] text-white'
        : tone === 'warning'
          ? 'bg-[color:var(--color-unilives-warning)] text-white'
          : tone === 'error'
            ? 'bg-[color:var(--color-unilives-error)] text-white'
            : tone === 'gold'
              ? 'bg-[color:var(--color-unilives-gold)] text-black'
              : 'bg-[color:var(--color-unilives-control-hover)] text-[color:var(--color-unilives-text)]';
  return (
    <span className={`${unilivesBadgeClass} ${toneClass} ${className}`} {...rest}>
      {children}
    </span>
  );
}
