import React from 'react';
import {
  resolveFrameAssetIdFromLegacyStyle,
  resolveIdentityMediaUrl,
} from '../../../lib/unilives-assets/identityResolve';

type Props = {
  /** Authoritative legacy frameStyle string from seat state — not renamed. */
  legacyFrameStyle?: string | null;
  canonicalFrameId?: string | null;
  /** Existing CSS classes that preserve layout (active fallback). */
  legacyClassName?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Live-seat frame: keeps legacy CSS classes for layout; overlays registry media only when production.
 */
export function UniLivesLiveAvatarFrame({
  legacyFrameStyle,
  canonicalFrameId,
  legacyClassName = '',
  className = 'relative',
  children,
}: Props) {
  const assetId = canonicalFrameId || resolveFrameAssetIdFromLegacyStyle(legacyFrameStyle);
  const visual = assetId ? resolveIdentityMediaUrl(assetId) : null;
  const showMedia = visual && visual.source === 'registry' && !visual.usedFallback;

  return (
    <span
      className={`${className} ${legacyClassName}`.trim()}
      data-unilives-live-avatar-frame=""
      data-legacy-frame-style={legacyFrameStyle ?? undefined}
      data-canonical-asset-id={assetId ?? undefined}
    >
      {showMedia ? (
        <img
          src={visual!.url}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain z-0"
        />
      ) : null}
      {children}
    </span>
  );
}
