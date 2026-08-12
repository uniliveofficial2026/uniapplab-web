import React from 'react';

type SpinnerProps = {
  className?: string;
  label?: string;
};

/** Inline spinner — respects reduced motion via CSS utilities. */
export function UniLivesSpinner({
  className = 'h-5 w-5 border-2 border-[color:var(--color-unilives-border)] border-t-[color:var(--color-unilives-primary)] rounded-full animate-spin motion-reduce:animate-none',
  label = 'Loading',
}: SpinnerProps) {
  return <div className={className} role="status" aria-label={label} />;
}

type SkeletonProps = {
  className?: string;
};

/** Skeleton block — preserve caller dimensions via className. */
export function UniLivesSkeleton({
  className = 'h-4 w-full rounded-[var(--radius-unilives-md)] bg-[color:var(--color-unilives-control-hover)] animate-pulse motion-reduce:animate-none',
}: SkeletonProps) {
  return <div className={className} aria-hidden />;
}

export function UniLivesDivider({
  className = 'h-px w-full bg-[color:var(--color-unilives-border)]',
}: {
  className?: string;
}) {
  return <div className={className} role="separator" />;
}
