import React from 'react';

type Props = {
  /** 0–1 progress. Visual only — parent owns step logic. */
  value?: number;
  className?: string;
};

/**
 * Optional progress bar. Not injected into the current single-screen layout
 * (no existing progress indicator) — exported for future multi-step without
 * changing Phase 4 structure.
 */
export function UniLivesProfileSetupProgress({
  value = 1,
  className = 'w-full max-w-[220px] h-1.5 rounded-full bg-[color:var(--color-unilives-profile-setup-border)] overflow-hidden',
}: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={className}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      data-unilives-profile-setup-progress=""
    >
      <div
        className="h-full rounded-full bg-[color:var(--color-unilives-profile-setup-selected)] transition-[width] duration-300 motion-reduce:transition-none"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
