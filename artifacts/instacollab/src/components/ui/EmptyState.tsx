import React from 'react';

type Props = {
  title: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
  role?: React.AriaRole;
};

export function UniLivesEmptyState({
  title,
  message,
  action,
  className = 'rounded-[var(--radius-unilives-xl)] border border-dashed border-[color:var(--color-unilives-border)] py-12 px-4 text-center space-y-3',
  role = 'status',
}: Props) {
  return (
    <div className={className} role={role} data-unilives-empty="">
      <p className="font-semibold text-[color:var(--color-unilives-text)]">{title}</p>
      {message ? (
        <p className="text-sm text-[color:var(--color-unilives-text-muted)]">{message}</p>
      ) : null}
      {action}
    </div>
  );
}

export function UniLivesErrorState({
  title,
  message,
  onRetry,
  className = 'rounded-[var(--radius-unilives-xl)] border border-[color:var(--color-unilives-error)]/40 bg-[color:var(--color-unilives-error)]/10 py-10 px-4 text-center space-y-3',
}: {
  title: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={className} role="alert" data-unilives-error="">
      <p className="font-semibold text-[color:var(--color-unilives-text)]">{title}</p>
      {message ? (
        <p className="text-sm text-[color:var(--color-unilives-text-muted)]">{message}</p>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-[var(--radius-unilives-pill)] border border-[color:var(--color-unilives-border)] bg-[color:var(--color-unilives-surface)] px-4 py-2 text-xs font-bold unilives-focus-ring"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
