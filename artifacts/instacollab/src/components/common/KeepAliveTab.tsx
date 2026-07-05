import React, { useEffect, useRef } from 'react';

type KeepAliveTabProps = {
  active: boolean;
  children: React.ReactNode;
  className?: string;
};

/**
 * Keep screen trees mounted after first visit — tab switches paint instantly
 * from local state instead of remounting lazy chunks.
 */
export function KeepAliveTab({ active, children, className = '' }: KeepAliveTabProps) {
  const [mounted, setMounted] = React.useState(active);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active) setMounted(true);
  }, [active]);

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

  if (!mounted) return null;

  return (
    <div
      ref={rootRef}
      className={`h-full min-h-0 flex flex-col ${active ? '' : 'hidden'} ${className}`.trim()}
      aria-hidden={!active}
      {...(!active ? { inert: '' as const } : {})}
    >
      {children}
    </div>
  );
}
