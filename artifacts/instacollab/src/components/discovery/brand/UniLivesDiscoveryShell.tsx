import React from 'react';
import { LaunchShell } from '../../launch/launchUi';
import type { DiscoverySurface } from './discoveryResolve';
import { hasProductionDiscoveryAsset, resolveDiscoveryAssetUrl } from './discoveryResolve';

type Props = {
  children: React.ReactNode;
  className?: string;
  surface?: DiscoverySurface;
  /** When true, skip LaunchShell (for surfaces already inside app shell). */
  bare?: boolean;
};

function DiscoveryBg({ surface }: { surface: DiscoverySurface }) {
  const id = `discovery.${surface}.background`;
  if (!hasProductionDiscoveryAsset(id)) return null;
  const src = resolveDiscoveryAssetUrl(id);
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden data-unilives-discovery-bg={surface}>
      <img src={src} alt="" className="h-full w-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-[color:var(--color-unilives-discovery-background)]/80" />
    </div>
  );
}

/**
 * Visual discovery shell. Launch surfaces use LaunchShell; in-app surfaces use bare wrapper.
 */
export function UniLivesDiscoveryShell({
  children,
  className = 'overflow-y-auto',
  surface = 'trending',
  bare = false,
}: Props) {
  if (bare) {
    return (
      <div
        className={`relative bg-[color:var(--color-unilives-discovery-background)] ${className}`}
        data-unilives-discovery-shell={surface}
      >
        <DiscoveryBg surface={surface} />
        <div className="relative z-10">{children}</div>
      </div>
    );
  }

  return (
    <LaunchShell
      className={`${className} bg-[color:var(--color-unilives-discovery-background)]`}
      decorationTone="onboarding"
    >
      <DiscoveryBg surface={surface} />
      {children}
    </LaunchShell>
  );
}
