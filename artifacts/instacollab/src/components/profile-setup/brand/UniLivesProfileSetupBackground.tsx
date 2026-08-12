import React from 'react';
import {
  hasProductionProfileSetupAsset,
  resolveProfileSetupAssetUrl,
  type ProfileSetupVisualSection,
} from './profileSetupResolve';

type Props = {
  section?: ProfileSetupVisualSection;
  hasCustomBackground?: boolean;
  className?: string;
};

/** Optional registry background. Missing production → null (shell orbs remain). */
export function UniLivesProfileSetupBackground({
  section = 'welcome',
  hasCustomBackground = false,
  className = 'pointer-events-none absolute inset-0',
}: Props) {
  if (hasCustomBackground) return null;
  const id =
    section === 'avatar'
      ? 'profile-setup.welcome.background'
      : `profile-setup.${section}.background`;
  if (!hasProductionProfileSetupAsset(id)) return null;
  const src = resolveProfileSetupAssetUrl(id);
  return (
    <div className={className} aria-hidden data-unilives-profile-setup-bg={section}>
      <img src={src} alt="" className="h-full w-full object-cover opacity-35" />
      <div className="absolute inset-0 bg-[color:var(--color-unilives-profile-setup-background)]/75" />
    </div>
  );
}
