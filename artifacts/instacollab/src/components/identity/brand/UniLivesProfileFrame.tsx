import React from 'react';
import { resolveIdentityMediaUrl } from '../../../lib/unilives-assets/identityResolve';

type Props = {
  canonicalFrameId?: string | null;
  className?: string;
  children: React.ReactNode;
};

/** Profile frame chrome — missing production → children unchanged. */
export function UniLivesProfileFrame({ canonicalFrameId, className = 'relative inline-flex', children }: Props) {
  const id = String(canonicalFrameId ?? '').trim();
  const visual = id ? resolveIdentityMediaUrl(id) : null;
  const showMedia = visual && visual.source === 'registry' && !visual.usedFallback;

  return (
    <span className={className} data-unilives-profile-frame="" data-canonical-asset-id={id || undefined}>
      {showMedia ? (
        <img
          src={visual!.url}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
      ) : null}
      <span className="relative z-10">{children}</span>
    </span>
  );
}
