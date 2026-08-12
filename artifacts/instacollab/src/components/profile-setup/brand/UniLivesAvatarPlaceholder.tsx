import React from 'react';
import {
  hasProductionProfileSetupAsset,
  resolveProfileSetupAssetUrl,
} from './profileSetupResolve';

type Props = {
  className?: string;
  alt?: string;
};

/**
 * Avatar placeholder when no user photo is set.
 * Uses registry production art when available; otherwise brand fallback.
 * Does not upload or invent user avatars.
 */
export function UniLivesAvatarPlaceholder({
  className = 'h-full w-full object-cover',
  alt = '',
}: Props) {
  const id = 'profile-setup.avatar.placeholder';
  const src = hasProductionProfileSetupAsset(id)
    ? resolveProfileSetupAssetUrl(id)
    : resolveProfileSetupAssetUrl('profile-setup.fallback.default');
  return <img src={src} alt={alt} className={className} aria-hidden={alt === '' ? true : undefined} />;
}
