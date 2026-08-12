import React from 'react';
import { LaunchShell } from '../../launch/launchUi';
import { UniLivesAuthBackground } from './UniLivesAuthBackground';
import type { AuthVisualMode } from './authResolve';

type Props = {
  children: React.ReactNode;
  className?: string;
  mode?: AuthVisualMode;
  backgroundUrl?: string | null;
  backgroundMediaType?: 'image' | 'video';
};

/**
 * Visual auth shell only. Reuses LaunchShell structure; no auth logic.
 */
export function UniLivesAuthShell({
  children,
  className = 'h-dvh max-h-dvh overflow-hidden p-0',
  mode = 'login',
  backgroundUrl,
  backgroundMediaType = 'image',
}: Props) {
  return (
    <LaunchShell
      className={`${className} bg-[color:var(--color-unilives-auth-background)]`}
      backgroundUrl={backgroundUrl}
      backgroundMediaType={backgroundMediaType}
      decorationTone="onboarding"
    >
      <UniLivesAuthBackground mode={mode} hasCustomBackground={Boolean(backgroundUrl)} />
      {children}
    </LaunchShell>
  );
}
