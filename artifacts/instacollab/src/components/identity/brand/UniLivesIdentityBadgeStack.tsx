import React from 'react';
import { UniLivesVerificationBadge } from './UniLivesVerificationBadge';
import { UniLivesVipBadge } from './UniLivesVipBadge';
import { UniLivesLevelBadge } from './UniLivesLevelBadge';
import { UniLivesRoleBadge } from './UniLivesRoleBadge';
import type { RoomRoleDisplay, VipDisplayTier } from '../../../lib/unilives-assets/identityResolve';

type Props = {
  userId?: string;
  isVerified?: boolean;
  premiumActive?: boolean;
  vipTier?: VipDisplayTier | string | null;
  level?: number;
  role?: RoomRoleDisplay | string | null;
  /** Max badges to show (preserves existing UI limits). */
  maxBadges?: number;
  className?: string;
};

/**
 * Deterministic stack: role → verification → VIP → level.
 * Parents pass authoritative state only.
 */
export function UniLivesIdentityBadgeStack({
  userId,
  isVerified,
  premiumActive,
  vipTier,
  level,
  role,
  maxBadges = 4,
  className = 'inline-flex items-center gap-0.5',
}: Props) {
  const items: React.ReactNode[] = [];
  if (role && role !== 'none') {
    items.push(<UniLivesRoleBadge key="role" role={role} userId={userId} />);
  }
  if (isVerified) {
    items.push(<UniLivesVerificationBadge key="verified" isVerified userId={userId} />);
  }
  if (premiumActive || vipTier) {
    items.push(<UniLivesVipBadge key="vip" premiumActive={premiumActive} vipTier={vipTier} userId={userId} />);
  }
  if (typeof level === 'number' && level > 0) {
    items.push(<UniLivesLevelBadge key="level" level={level} userId={userId} />);
  }
  return (
    <span className={className} data-unilives-identity-badge-stack="" data-user-id={userId}>
      {items.slice(0, maxBadges)}
    </span>
  );
}
