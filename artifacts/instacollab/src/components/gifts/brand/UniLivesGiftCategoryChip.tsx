import React from 'react';

type Props = {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
};

/** Visual chrome for gift category tabs — selection logic stays in parent. */
export function UniLivesGiftCategoryChip({
  label,
  selected = false,
  onClick,
  className = '',
  disabled = false,
}: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        className ||
        `shrink-0 rounded-full px-3 py-1 text-[10px] font-bold transition ${
          selected
            ? 'bg-[color:var(--color-unilives-primary)] text-white'
            : 'bg-white/5 text-[color:var(--color-unilives-text-muted,#B0A6C8)] hover:text-white'
        }`
      }
      data-unilives-gift-category-chip=""
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}
