import React from 'react';
import {
  hasProductionOnboardingBackground,
  onboardingBackgroundId,
  resolveOnboardingAssetUrl,
  type OnboardingStepKey,
} from './onboardingResolve';

type Props = {
  step: OnboardingStepKey;
  /** When user uploaded a custom background, skip registry decoration. */
  hasCustomBackground?: boolean;
  className?: string;
};

/**
 * Optional decorative / registry background layer for onboarding.
 * Does not replace LaunchShell structure. When production BG is missing and no
 * custom upload exists, renders restrained token-based orbs (visual only).
 */
export function UniLivesOnboardingBackground({
  step,
  hasCustomBackground = false,
  className = 'pointer-events-none absolute inset-0 overflow-hidden',
}: Props) {
  if (hasCustomBackground) return null;

  const useProduction = hasProductionOnboardingBackground(step);
  if (useProduction) {
    const src = resolveOnboardingAssetUrl(onboardingBackgroundId(step));
    return (
      <div className={className} aria-hidden data-unilives-onboarding-bg={step}>
        <img src={src} alt="" className="h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-[color:var(--color-unilives-onboarding-background)]/70" />
      </div>
    );
  }

  return (
    <div className={className} aria-hidden data-unilives-onboarding-bg={step}>
      <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-[color:var(--color-unilives-onboarding-decoration)]/25 blur-3xl" />
      <div className="absolute top-1/3 -left-20 h-64 w-64 rounded-full bg-[color:var(--color-unilives-primary)]/20 blur-3xl" />
      <div className="absolute bottom-0 right-1/4 h-56 w-56 rounded-full bg-[color:var(--color-unilives-accent)]/20 blur-3xl" />
    </div>
  );
}
