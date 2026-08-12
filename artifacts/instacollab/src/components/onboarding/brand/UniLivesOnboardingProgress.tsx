import React from 'react';

type Props = {
  count: number;
  activeIndex: number;
  /** Stable keys for each step (existing titles). */
  labels: readonly string[];
  className?: string;
};

/**
 * Visual pagination only. Parent owns index / navigation.
 * Dimensions match prior onboarding dots (h-1.5, active w-8, inactive w-2).
 */
export function UniLivesOnboardingProgress({
  count,
  activeIndex,
  labels,
  className = 'flex gap-2 mt-10',
}: Props) {
  return (
    <div className={className} role="tablist" aria-label="Onboarding progress">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={labels[i] ?? i}
          role="presentation"
          className={`h-1.5 rounded-full transition-all ${
            i === activeIndex
              ? 'w-8 bg-[color:var(--color-unilives-onboarding-progress)]'
              : 'w-2 bg-[color:var(--color-unilives-onboarding-muted)]/40'
          }`}
          aria-current={i === activeIndex ? 'step' : undefined}
        />
      ))}
    </div>
  );
}
