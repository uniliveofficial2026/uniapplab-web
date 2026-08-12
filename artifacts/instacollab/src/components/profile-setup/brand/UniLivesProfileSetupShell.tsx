import React from 'react';
import { LaunchShell } from '../../launch/launchUi';
import { UniLivesProfileSetupBackground } from './UniLivesProfileSetupBackground';
import type { ProfileSetupVisualSection } from './profileSetupResolve';

type Props = {
  children: React.ReactNode;
  className?: string;
  section?: ProfileSetupVisualSection;
  backgroundUrl?: string | null;
  backgroundMediaType?: 'image' | 'video';
};

/**
 * Visual profile-setup shell only. Reuses LaunchShell; no profile logic.
 */
export function UniLivesProfileSetupShell({
  children,
  className = 'p-4 sm:p-6',
  section = 'welcome',
  backgroundUrl,
  backgroundMediaType = 'image',
}: Props) {
  return (
    <LaunchShell
      className={`${className} bg-[color:var(--color-unilives-profile-setup-background)]`}
      backgroundUrl={backgroundUrl}
      backgroundMediaType={backgroundMediaType}
      decorationTone="onboarding"
    >
      <UniLivesProfileSetupBackground
        section={section}
        hasCustomBackground={Boolean(backgroundUrl)}
      />
      {children}
    </LaunchShell>
  );
}
