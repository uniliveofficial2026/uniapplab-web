import React from 'react';
import { UniLivesBrandMark } from '../../brand/UniLivesBrandMark';

type Props = {
  className?: string;
  markClassName?: string;
};

/**
 * Compact onboarding brand mark. Optional — only render where layout already allows.
 * Does not change navigation or step logic.
 */
export function UniLivesOnboardingLogo({
  className = 'flex justify-center',
  markClassName = 'w-10 h-10 rounded-xl',
}: Props) {
  return (
    <div className={className}>
      <UniLivesBrandMark variant="icon" context="header" className={markClassName} />
    </div>
  );
}
