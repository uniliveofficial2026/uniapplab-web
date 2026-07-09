import React, { useEffect, useRef } from 'react';

type KeepAliveTabProps = {
  active: boolean;
  children: React.ReactNode;
  className?: string;
};

/**
 * Keep screen trees mounted — parent only renders tabs in visitedTabs,
 * so children mount immediately (no lazy-wait on tab switch).
 */
export function KeepAliveTab({ active, children, className = '' }: KeepAliveTabProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active) return;
    rootRef.current?.querySelectorAll('video').forEach((video) => {
      try {
        video.pause();
      } catch {
        /* ignore */
      }
    });
  }, [active]);

  return (
    <div
      ref={rootRef}
      className={`h-full min-h-0 flex flex-col ${active ? '' : 'hidden'} ${className}`.trim()}
      aria-hidden={!active}
      {...(!active ? { inert: true as const } : {})}
    >
      {children}
    </div>
  );
}
