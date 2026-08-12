import React from 'react';
import { resolveIdentityMediaUrl } from '../../../lib/unilives-assets/identityResolve';

type Props = {
  canonicalRingId?: string | null;
  /** When no production ring, parent keeps existing CSS ring. */
  className?: string;
  children: React.ReactNode;
};

/**
 * Optional registry ring overlay. pointer-events-none.
 * Does not change avatar hit target. Missing media → children only (no invent).
 */
export function UniLivesAvatarRing({ canonicalRingId, className = 'relative inline-flex', children }: Props) {
  const id = String(canonicalRingId ?? '').trim();
  const visual = id ? resolveIdentityMediaUrl(id) : null;
  const showMedia = visual && visual.source === 'registry' && !visual.usedFallback;

  return (
    <span className={className} data-unilives-avatar-ring="" data-canonical-asset-id={id || undefined}>
      {showMedia ? (
        <img
          src={visual!.url}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute -inset-[3px] h-[calc(100%+6px)] w-[calc(100%+6px)] max-w-none object-contain"
        />
      ) : null}
      <span className="relative z-10">{children}</span>
    </span>
  );
}
