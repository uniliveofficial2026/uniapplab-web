import React from 'react';
import { Zap } from 'lucide-react';
import { levelDisplayBucket, resolveLevelBadgeAssetId } from '../../../lib/unilives-assets/identityResolve';
import { UniLivesIdentityMedia } from './UniLivesIdentityMedia';

type Props = {
  /** Authoritative stored level — display bucket is visual-only. */
  level: number;
  userId?: string;
  showLabel?: boolean;
  tierLabel?: string;
  className?: string;
  iconClassName?: string;
};

export function UniLivesLevelBadge({
  level,
  userId,
  showLabel = false,
  tierLabel,
  className = 'inline-flex items-center gap-1 shrink-0 font-bold text-orange-500',
  iconClassName = 'w-3.5 h-3.5 fill-orange-500 text-orange-500',
}: Props) {
  const assetId = resolveLevelBadgeAssetId(level);
  const bucket = levelDisplayBucket(level);
  return (
    <span
      className={className}
      data-unilives-level-badge=""
      data-user-id={userId}
      data-level={level}
      data-level-bucket={bucket.bucket}
      aria-label={`Level ${level}${tierLabel ? `, ${tierLabel}` : ''}`}
    >
      <UniLivesIdentityMedia
        canonicalAssetId={assetId}
        legacyNode={<Zap className={iconClassName} aria-hidden />}
        imgClassName={iconClassName}
        decorative
      />
      {showLabel ? (
        <span className="tabular-nums">
          Lvl {level}
          {tierLabel ? ` ${tierLabel}` : ''}
        </span>
      ) : null}
    </span>
  );
}
