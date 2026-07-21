import React, { useMemo } from 'react';
import { resolveGreedyTapAppUrl } from '../../lib/greedyTap/config';

/** Local package server — same fixed UI as http://127.0.0.1:3000/ */
const LOCAL_FIXED_GREEDY_URL = 'http://127.0.0.1:3000/';

function greedyAppUrl(): string {
  if (import.meta.env.DEV) return LOCAL_FIXED_GREEDY_URL;
  return resolveGreedyTapAppUrl();
}

/**
 * Greedy tab — iframe mounts with src on first paint (no boot spinner).
 * KeepAlive + early warm-mount keep the game resident for instant tab switches.
 */
export function GreedyTapScreen() {
  const appUrl = useMemo(() => greedyAppUrl(), []);

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
  const href = greedyAppUrl();
  if (document.querySelector(`link[data-greedy-prefetch="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  link.setAttribute('data-greedy-prefetch', href);
  document.head.appendChild(link);
}
