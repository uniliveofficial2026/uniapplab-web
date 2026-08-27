import React, { useEffect } from 'react';
import { resolveGreedyTapAppUrl } from '../../lib/greedyTap/config';
import { wakeGreedyRealtimeInBackground } from '../../lib/greedyTap/keepAlive';

/**
 * Greedy tab slot — the live iframe is owned by GreedySessionProvider
 * (fullscreen on this tab, PiP / icon when browsing the rest of UniLive).
 */
export function GreedyTapScreen() {
  useEffect(() => {
    wakeGreedyRealtimeInBackground();
    window.dispatchEvent(
      new CustomEvent('uniapplab-greedy-session', { detail: { action: 'open-fullscreen' } }),
    );
  }, []);

  // Black underlay only; the provider portals the real game above the shell.
  return <div className="relative h-full min-h-0 w-full flex-1 bg-black" aria-hidden />;
}

/** Prefetch Greedy shell + wake Render realtime in the background. */
export function prefetchGreedyTap(): void {
  if (typeof document === 'undefined') return;
  wakeGreedyRealtimeInBackground();
  const href = resolveGreedyTapAppUrl();
  if (document.querySelector(`link[data-greedy-prefetch="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  link.setAttribute('data-greedy-prefetch', href);
  document.head.appendChild(link);
}
