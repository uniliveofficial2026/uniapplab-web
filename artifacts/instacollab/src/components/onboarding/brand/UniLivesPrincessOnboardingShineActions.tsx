import React from 'react';

type Props = {
  onGetStarted: () => void;
  onSkip: () => void;
};

/**
 * Invisible hits locked to the approved onboarding Shine Your Way artwork.
 * Visual chrome (Get Started, dots, logo, copy) stays in the art.
 */
export function UniLivesPrincessOnboardingShineActions({ onGetStarted, onSkip }: Props) {
  return (
    <div className="ups-actions" data-unilives-princess-onboarding-shine-actions="">
      <button type="button" className="ups-hit ups-hit-skip" aria-label="Skip onboarding" onClick={onSkip} />
      <button
        type="button"
        className="ups-hit ups-hit-start"
        aria-label="Get started"
        onClick={onGetStarted}
      />
    </div>
  );
}
