import React from 'react';

/** Shown while lazy-loaded tab screens are loading. */
export function ScreenFallback() {
  return (
    <div
      className="flex flex-1 min-h-[50vh] items-center justify-center text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-label="Loading screen"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
    </div>
  );
}
