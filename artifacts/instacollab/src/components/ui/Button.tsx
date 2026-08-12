import React from 'react';
import {
  unilivesButtonBaseClass,
  unilivesButtonSizeClass,
  unilivesButtonVariantClass,
  type UniLivesButtonSize,
  type UniLivesButtonVariant,
} from './classes';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: UniLivesButtonVariant;
  size?: UniLivesButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
};

/**
 * Canonical UniLive’s button — visual states only.
 * Preserves native button semantics, type, disabled, and handlers.
 */
export function UniLivesButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: Props) {
  const sizeKey = variant === 'icon' ? 'icon' : size;
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${unilivesButtonBaseClass} ${unilivesButtonVariantClass[variant]} ${unilivesButtonSizeClass[sizeKey]} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      {...rest}
    >
      {loading ? <span className="opacity-80">…</span> : null}
      {children}
    </button>
  );
}
