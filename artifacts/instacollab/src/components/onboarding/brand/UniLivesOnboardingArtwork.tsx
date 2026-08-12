import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { APP_DISPLAY_NAME } from '../../../lib/appBrand';
import {
  hasProductionOnboardingIllustration,
  onboardingIllustrationId,
  resolveOnboardingAssetUrl,
  type OnboardingStepKey,
} from './onboardingResolve';

type Props = {
  step: OnboardingStepKey;
  /** Existing Lucide icon — preserved as working fallback illustration. */
  FallbackIcon: LucideIcon;
  className?: string;
  iconClassName?: string;
};

/**
 * Slide artwork tile visual only. Does not own upload or onboarding state.
 * When production illustration is missing, renders the existing Lucide icon.
 */
export function UniLivesOnboardingArtwork({
  step,
  FallbackIcon,
  className = 'relative h-20 w-20 rounded-3xl flex items-center justify-center overflow-hidden',
  iconClassName = 'h-10 w-10',
}: Props) {
  const useProduction = hasProductionOnboardingIllustration(step);
  const src = resolveOnboardingAssetUrl(onboardingIllustrationId(step));

  return (
    <div
      className={`${className} bg-[color:var(--color-unilives-onboarding-surface)] text-[color:var(--color-unilives-primary)]`}
      data-unilives-onboarding-artwork={step}
    >
      {useProduction ? (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-contain p-2"
          draggable={false}
        />
      ) : (
        <FallbackIcon className={iconClassName} strokeWidth={1.75} aria-hidden />
      )}
      <span className="sr-only">{APP_DISPLAY_NAME} onboarding artwork</span>
    </div>
  );
}
