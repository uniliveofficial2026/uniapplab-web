import React from 'react';

type Props = {
  title: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
};

export function UniLivesDiscoveryEmptyState({
  title,
  message,
  action,
  className = 'rounded-2xl border border-dashed border-[color:var(--color-unilives-discovery-border)] py-12 text-center text-[color:var(--color-unilives-discovery-muted)] text-sm space-y-3',
}: Props) {
  return (
    <div className={className} role="status" data-unilives-discovery-empty="">
      <p className="font-semibold text-[color:var(--color-unilives-discovery-text)]">{title}</p>
      {message ? <p>{message}</p> : null}
      {action}
    </div>
  );
}

export function UniLivesDiscoveryLoadingState({
  label = 'Loading…',
  className = 'rounded-2xl border border-[color:var(--color-unilives-discovery-border)] py-12 text-center text-[color:var(--color-unilives-discovery-muted)] text-sm',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={className} role="status" aria-live="polite" data-unilives-discovery-loading="">
      {label}
    </div>
  );
}

export function UniLivesDiscoveryErrorState({
  title,
  message,
  onRetry,
  className = 'rounded-2xl border border-[color:var(--color-unilives-discovery-error)]/40 bg-[color:var(--color-unilives-discovery-error)]/10 py-10 px-4 text-center text-sm space-y-3',
}: {
  title: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={className} role="alert" data-unilives-discovery-error="">
      <p className="font-semibold text-[color:var(--color-unilives-discovery-text)]">{title}</p>
      {message ? <p className="text-[color:var(--color-unilives-discovery-muted)]">{message}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-[color:var(--color-unilives-discovery-border)] bg-[color:var(--color-unilives-discovery-surface)] px-4 py-2 text-xs font-bold text-[color:var(--color-unilives-discovery-text)]"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
