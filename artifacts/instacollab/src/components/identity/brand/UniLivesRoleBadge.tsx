import React from 'react';
import { Shield } from 'lucide-react';
import { resolveRoleBadgeAssetId, type RoomRoleDisplay } from '../../../lib/unilives-assets/identityResolve';
import { UniLivesIdentityMedia } from './UniLivesIdentityMedia';

type Props = {
  role: RoomRoleDisplay | string | null | undefined;
  userId?: string;
  className?: string;
  iconClassName?: string;
  label?: string;
};

export function UniLivesRoleBadge({
  role,
  userId,
  className = 'inline-flex shrink-0',
  iconClassName = 'w-3.5 h-3.5 text-violet-400',
  label,
}: Props) {
  const assetId = resolveRoleBadgeAssetId(role);
  if (!assetId) return null;
  const text = label || String(role);
  return (
    <span className={className} data-unilives-role-badge="" data-user-id={userId} data-role={String(role)} title={text} aria-label={text}>
      <UniLivesIdentityMedia
        canonicalAssetId={assetId}
        legacyNode={<Shield className={iconClassName} aria-hidden />}
        imgClassName={iconClassName}
        decorative={false}
        alt={text}
      />
    </span>
  );
}
