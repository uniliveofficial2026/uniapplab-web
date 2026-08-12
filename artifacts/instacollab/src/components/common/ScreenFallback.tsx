import React from 'react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { UniLivesSkeleton } from '../ui';

/**
 * Always-visible screen placeholder — never a blank page.
 * Offline: clear “saved content” messaging; online: light skeleton.
 */
export function ScreenFallback() {
  const network = useNetworkStatus();
  const offline = network === 'offline';

  return (
    <div
      className="flex flex-1 min-h-0 flex-col w-full bg-[color:var(--color-unilives-background)] text-[color:var(--color-unilives-text)]"
      role="status"
      aria-live="polite"
      aria-label={offline ? 'Offline — showing saved layout' : 'Loading screen'}
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[color:var(--color-unilives-border)]">
        <UniLivesSkeleton className="h-9 w-9 rounded-full bg-[color:var(--color-unilives-control-hover)] animate-pulse motion-reduce:animate-none" />
        <div className="flex-1 space-y-2">
          <UniLivesSkeleton className="h-3 w-28 rounded-[var(--radius-unilives-sm)] bg-[color:var(--color-unilives-control-hover)] animate-pulse motion-reduce:animate-none" />
          <UniLivesSkeleton className="h-2.5 w-20 rounded-[var(--radius-unilives-sm)] bg-[color:var(--color-unilives-control-hover)]/70 animate-pulse motion-reduce:animate-none" />
        </div>
      </div>
      <div className="flex-1 space-y-3 p-4">
        <UniLivesSkeleton className="h-40 w-full rounded-[var(--radius-unilives-xl)] bg-[color:var(--color-unilives-control-hover)]/80 animate-pulse motion-reduce:animate-none" />
        <UniLivesSkeleton className="h-3 w-3/4 rounded-[var(--radius-unilives-sm)] bg-[color:var(--color-unilives-control-hover)] animate-pulse motion-reduce:animate-none" />
        <UniLivesSkeleton className="h-3 w-1/2 rounded-[var(--radius-unilives-sm)] bg-[color:var(--color-unilives-control-hover)]/70 animate-pulse motion-reduce:animate-none" />
        <UniLivesSkeleton className="h-40 w-full rounded-[var(--radius-unilives-xl)] bg-[color:var(--color-unilives-control-hover)]/80 animate-pulse motion-reduce:animate-none" />
        {offline ? (
          <p className="pt-4 text-center text-sm font-medium text-[color:var(--color-unilives-text-muted)]">
            Offline — your saved feed and profile stay available. Open this tab once online to cache it for next time.
          </p>
        ) : null}
      </div>
    </div>
  );
}
