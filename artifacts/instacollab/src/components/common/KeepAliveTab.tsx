import React, { useEffect, useRef } from 'react';
import { KeepAliveTabActiveContext } from '../../lib/keepAliveTabContext';

type KeepAliveTabProps = {
  active: boolean;
  children: React.ReactNode;
  className?: string;
};

/**
 * Keep screen trees mounted — parent only renders tabs in visitedTabs,
 * so children mount immediately (no lazy-wait on tab switch).
 * Inactive tabs stay mounted but pause media and signal hooks to stop polling.
 */
export function KeepAliveTab({ active, children, className = '' }: KeepAliveTabProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active) return;
    rootRef.current?.querySelectorAll('video').forEach((video) => {
      // Never pause camera / WebAR / call sinks — blank preview on tab hide.
      if (
        video.dataset.appCamera === '1' ||
        video.dataset.webarOutput === '1' ||
        video.dataset.livePreview === '1' ||
        video.dataset.callVideo === '1'
      ) {
        return;
      }
      try {
        video.pause();
      } catch {
        /* ignore */
      }
    });
  }, [active]);

  return (
    <KeepAliveTabActiveContext.Provider value={active}>
      <div
        ref={rootRef}
        className={`h-full min-h-0 flex flex-col ${active ? '' : 'hidden'} ${className}`.trim()}
        aria-hidden={!active}
        {...(!active ? { inert: true as const } : {})}
      >
        {children}
      </div>
    </KeepAliveTabActiveContext.Provider>
  );
}
