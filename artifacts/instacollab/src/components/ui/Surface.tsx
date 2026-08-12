import React from 'react';

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Visual density only. */
  raised?: boolean;
};

/**
 * Modal/sheet surface chrome — parent owns portal, focus trap, dismissal.
 */
export function UniLivesSurface({
  children,
  className = 'rounded-[var(--radius-unilives-xl)] border border-[color:var(--color-unilives-border)] bg-[color:var(--color-unilives-surface-raised)] text-[color:var(--color-unilives-text)] shadow-[var(--shadow-unilives-overlay)]',
  raised = true,
}: Props) {
  return (
    <div
      className={raised ? className : className.replace('shadow-[var(--shadow-unilives-overlay)]', 'shadow-[var(--shadow-unilives-md)]')}
      data-unilives-surface=""
    >
      {children}
    </div>
  );
}

/** Avatar circular frame — does not change ring/VIP/badge media. */
export function UniLivesAvatarFrame({
  children,
  className = 'rounded-full overflow-hidden border border-[color:var(--color-unilives-border)] bg-[color:var(--color-unilives-control-hover)]',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className} data-unilives-avatar-frame="">
      {children}
    </div>
  );
}
