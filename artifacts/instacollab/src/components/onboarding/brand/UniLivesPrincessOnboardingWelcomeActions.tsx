import React from 'react';

type Props = {
  onNext: () => void;
  onSkip: () => void;
};

/**
 * Invisible hits locked to the approved onboarding welcome artwork.
 * Visual chrome (Next, dots, logo, copy) stays in the art.
 */
export function UniLivesPrincessOnboardingWelcomeActions({ onNext, onSkip }: Props) {
  return (
    <div className="upw-actions" data-unilives-princess-onboarding-welcome-actions="">
      <button type="button" className="upw-hit upw-hit-skip" aria-label="Skip onboarding" onClick={onSkip} />
      <button type="button" className="upw-hit upw-hit-next" aria-label="Next" onClick={onNext} />
    </div>
  );
}
