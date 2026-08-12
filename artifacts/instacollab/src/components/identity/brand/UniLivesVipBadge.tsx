import React from 'react';
import { Crown } from 'lucide-react';
import { resolveVipBadgeAssetId, type VipDisplayTier } from '../../../lib/unilives-assets/identityResolve';
import { UniLivesIdentityMedia } from './UniLivesIdentityMedia';

type Props = {
  premiumActive?: boolean;
  vipTier?: VipDisplayTier | string | null;
  userId?: string;
  className?: string;
  iconClassName?: string;
};

export function UniLivesVipBadge({
  premiumActive,
  vipTier,
  userId,
  className = 'inline-flex shrink-0',
  iconClassName = 'w-3.5 h-3.5 text-amber-500',
}: Props) {
  const assetId = resolveVipBadgeAssetId({ premiumActive, vipTier });
  if (!assetId) return null;
  return (
    <span className={className} data-unilives-vip-badge="" data-user-id={userId} title="VIP" aria-label="VIP">
      <UniLivesIdentityMedia
        canonicalAssetId={assetId}
        legacyNode={<Crown className={iconClassName} aria-hidden />}
        imgClassName={iconClassName}
        decorative={false}
        alt="VIP"
      />
    </span>
  );
}
