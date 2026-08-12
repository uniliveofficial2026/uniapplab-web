import React from 'react';

type Props = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};

/**
 * Interest chip chrome only — not wired into launch ProfileSetupScreen
 * (no interests UI exists). Parent would own selection IDs and limits.
 */
export function UniLivesInterestChip({
  label,
  selected = false,
  disabled = false,
  onClick,
  className = '',
}: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors motion-reduce:transition-none disabled:opacity-50 ${
        selected
          ? 'border-[color:var(--color-unilives-profile-setup-selected)] bg-[color:var(--color-unilives-profile-setup-selected)] text-white'
          : 'border-[color:var(--color-unilives-profile-setup-border)] bg-[color:var(--color-unilives-profile-setup-surface)] text-[color:var(--color-unilives-profile-setup-text)]'
      } ${className}`}
    >
      {label}
    </button>
  );
}
