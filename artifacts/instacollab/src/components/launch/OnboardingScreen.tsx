import React, { useState } from 'react';
import { useDB } from '../../lib/useDB';
import {
  UniLivesPrincessOnboardingConnectActions,
  UniLivesPrincessOnboardingConnectLayout,
  UniLivesPrincessOnboardingShineActions,
  UniLivesPrincessOnboardingShineLayout,
  UniLivesPrincessOnboardingWelcomeActions,
  UniLivesPrincessOnboardingWelcomeLayout,
} from '../onboarding/brand';
import { markOnboardingCompleteThisSession } from '../../lib/splashSession';

/** Locked 3-slide princess funnel: welcome → connect → shine. */
const SLIDE_COUNT = 3;

export function OnboardingScreen() {
  const db = useDB();
  const [index, setIndex] = useState(0);
  const isLast = index >= SLIDE_COUNT - 1;

  const finish = () => {
    markOnboardingCompleteThisSession();
    db.completeOnboarding();
  };

  const goNext = () => {
    if (isLast) finish();
    else setIndex((i) => i + 1);
  };

  if (index === 0) {
    return (
      <UniLivesPrincessOnboardingWelcomeLayout>
        <UniLivesPrincessOnboardingWelcomeActions onNext={goNext} onSkip={finish} />
      </UniLivesPrincessOnboardingWelcomeLayout>
    );
  }

  if (index === 1) {
    return (
      <UniLivesPrincessOnboardingConnectLayout>
        <UniLivesPrincessOnboardingConnectActions onNext={goNext} onSkip={finish} />
      </UniLivesPrincessOnboardingConnectLayout>
    );
  }

  return (
    <UniLivesPrincessOnboardingShineLayout>
      <UniLivesPrincessOnboardingShineActions onGetStarted={finish} onSkip={finish} />
    </UniLivesPrincessOnboardingShineLayout>
  );
}
