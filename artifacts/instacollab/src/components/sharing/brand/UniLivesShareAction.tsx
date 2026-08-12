import React from 'react';

type Props = {
  label: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
};

/** Presentational share action button — handler supplied by parent. */
export function UniLivesShareAction({
  label,
  onClick,
  className = '',
  disabled,
  icon,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-unilives-share-action=""
      aria-label={label}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
