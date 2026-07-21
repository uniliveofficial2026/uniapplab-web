import React, { useEffect, useMemo } from 'react';
import { resolveGreedyTapAppUrl } from '../../lib/greedyTap/config';

/**
 * Greedy tab — same-origin iframe on first paint for instant load on
 * http://localhost:5173/greedy-tap and https://app.uniapplab.com/greedy-tap.
 */
export function GreedyTapScreen() {
  const appUrl = useMemo(() => resolveGreedyTapAppUrl(), []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if ((data as { source?: string }).source !== 'uniapplab-greedy') return;
      if ((data as { type?: string }).type !== 'navigate') return;
      const tab = (data as { tab?: string }).tab;
      if (!tab) return;
      window.dispatchEvent(new CustomEvent('navigate', { detail: { tab } }));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-black">
      <iframe
        title="Greedy"
        src={appUrl}
        className="h-full min-h-0 w-full flex-1 border-0 bg-black"
        allow="fullscreen; gamepad; autoplay; clipboard-read; clipboard-write"
        loading="eager"
      />
    </div>
  );
}

/** Prefetch Greedy so the browser starts loading before the tab is opened. */
export function prefetchGreedyTap(): void {
  if (typeof document === 'undefined') return;
  const href = resolveGreedyTapAppUrl();
  if (document.querySelector(`link[data-greedy-prefetch="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  link.setAttribute('data-greedy-prefetch', href);
  document.head.appendChild(link);
}
