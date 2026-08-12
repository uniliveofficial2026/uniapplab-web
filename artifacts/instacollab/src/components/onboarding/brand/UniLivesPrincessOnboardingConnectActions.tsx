import React from 'react';

type Props = {
  onNext: () => void;
  onSkip: () => void;
};

/**
 * Invisible hits locked to the approved onboarding Connect Together artwork.
 * Visual chrome (Next, dots, logo, copy) stays in the art.
 */
export function UniLivesPrincessOnboardingConnectActions({ onNext, onSkip }: Props) {
  return (
    <div className="upc-actions" data-unilives-princess-onboarding-connect-actions="">
      <button type="button" className="upc-hit upc-hit-skip" aria-label="Skip onboarding" onClick={onSkip} />
      <button type="button" className="upc-hit upc-hit-next" aria-label="Next" onClick={onNext} />
    </div>
  );
}
