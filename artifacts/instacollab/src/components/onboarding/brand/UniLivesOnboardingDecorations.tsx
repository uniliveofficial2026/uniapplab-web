import React from 'react';
import { detectPrefersReducedMotion } from '../../../lib/unilives-assets';
import { resolveOnboardingAssetUrl } from './onboardingResolve';

type Props = {
  className?: string;
};

/**
 * Subtle decorative layer. Hidden under reduced-motion / when production
 * decoration assets are missing (avoids broken images).
 */
export function UniLivesOnboardingDecorations({
  className = 'pointer-events-none absolute inset-x-0 top-16 flex justify-center gap-8 opacity-30',
}: Props) {
  if (detectPrefersReducedMotion()) return null;

  // Production decoration files are missing — do not render broken <img> tags.
  // Reserve the component for when assets become production.
  const sparkles = resolveOnboardingAssetUrl('onboarding.decorative.sparkles');
  const unicorn = resolveOnboardingAssetUrl('onboarding.decorative.unicorn');
  const knownGood = '/brand/app-logo.png';
  if (sparkles === knownGood && unicorn === knownGood) {
    return null;
  }

  return (
    <div className={className} aria-hidden>
      {sparkles !== knownGood ? (
        <img src={sparkles} alt="" className="h-8 w-8 object-contain" />
      ) : null}
      {unicorn !== knownGood ? (
        <img src={unicorn} alt="" className="h-8 w-8 object-contain" />
      ) : null}
    </div>
  );
}
