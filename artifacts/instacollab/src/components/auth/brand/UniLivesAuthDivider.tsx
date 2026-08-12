import React from 'react';

type Props = {
  label?: string;
  className?: string;
};

/** Visual divider only. */
export function UniLivesAuthDivider({
  label = 'or email',
  className = 'flex items-center gap-3 py-1',
}: Props) {
  return (
    <div className={className}>
      <div className="h-px flex-1 bg-[color:var(--color-unilives-auth-border)]" />
      <span className="text-xs font-medium text-[color:var(--color-unilives-auth-muted)] uppercase tracking-wide shrink-0">
        {label}
      </span>
      <div className="h-px flex-1 bg-[color:var(--color-unilives-auth-border)]" />
    </div>
  );
}
