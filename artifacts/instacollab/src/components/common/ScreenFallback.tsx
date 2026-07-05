import React from 'react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

/**
 * Always-visible screen placeholder — never a blank page.
 * Offline: clear “saved content” messaging; online: light skeleton.
 */
export function ScreenFallback() {
  const network = useNetworkStatus();
  const offline = network === 'offline';

  return (
    <div
      className="flex flex-1 min-h-0 flex-col w-full bg-background text-foreground"
      role="status"
      aria-live="polite"
      aria-label={offline ? 'Offline — showing saved layout' : 'Loading screen'}
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="h-9 w-9 rounded-full bg-secondary animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-28 rounded bg-secondary animate-pulse" />
          <div className="h-2.5 w-20 rounded bg-secondary/70 animate-pulse" />
        </div>
      </div>
      <div className="flex-1 space-y-3 p-4">
        <div className="h-40 w-full rounded-2xl bg-secondary/80 animate-pulse" />
        <div className="h-3 w-3/4 rounded bg-secondary animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-secondary/70 animate-pulse" />
        <div className="h-40 w-full rounded-2xl bg-secondary/80 animate-pulse" />
        {offline ? (
          <p className="pt-4 text-center text-sm font-medium text-muted-foreground">
            Offline — your saved feed and profile stay available. Open this tab once online to cache it for next time.
          </p>
        ) : null}
      </div>
    </div>
  );
}
