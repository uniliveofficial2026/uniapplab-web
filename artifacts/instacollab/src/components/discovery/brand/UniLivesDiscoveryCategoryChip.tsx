import React from 'react';

type Props = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};

/** Category chip chrome — parent owns filter IDs and selection rules. */
export function UniLivesDiscoveryCategoryChip({
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
          ? 'border-[color:var(--color-unilives-discovery-selected)] bg-[color:var(--color-unilives-discovery-selected)] text-white'
          : 'border-[color:var(--color-unilives-discovery-border)] bg-[color:var(--color-unilives-discovery-surface)] text-[color:var(--color-unilives-discovery-text)]'
      } ${className}`}
    >
      {label}
    </button>
  );
}
