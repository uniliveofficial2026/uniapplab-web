import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { resolveVerificationBadgeAssetId } from '../../../lib/unilives-assets/identityResolve';
import { UniLivesIdentityMedia } from './UniLivesIdentityMedia';

type Props = {
  /** Authoritative verification state — never inferred. */
  isVerified: boolean;
  userId?: string;
  className?: string;
  iconClassName?: string;
};

export function UniLivesVerificationBadge({
  isVerified,
  userId,
  className = 'inline-flex shrink-0',
  iconClassName = 'w-3.5 h-3.5 text-primary',
}: Props) {
  if (!isVerified) return null;
  const assetId = resolveVerificationBadgeAssetId(true);
  return (
    <span
      className={className}
      data-unilives-verification-badge=""
      data-user-id={userId}
      title="Verified"
      aria-label="Verified"
    >
      <UniLivesIdentityMedia
        canonicalAssetId={assetId}
        legacyNode={<CheckCircle2 className={`${iconClassName} fill-primary/10`} aria-hidden />}
        imgClassName={iconClassName}
        decorative={false}
        alt="Verified"
      />
    </span>
  );
}
