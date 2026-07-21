import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  greedyTapHealthUrl,
  isGreedyTapReadyPayload,
  resolveGreedyTapAppUrl,
} from '../../lib/greedyTap/config';

const HEALTH_POLL_MS = 600;
const HEALTH_TIMEOUT_MS = 20_000;

async function waitForGreedyTapReady(): Promise<boolean> {
  // Production ships the game static shell on UniLive — open immediately.
  // Live APIs/socket.io are already proxied to Render.
  if (!import.meta.env.DEV) {
    return true;
  }

  const healthUrl = greedyTapHealthUrl();
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const health = await fetch(healthUrl, { cache: 'no-store' });
      if (health.ok) {
        const body: unknown = await health.json();
        if (isGreedyTapReadyPayload(body, healthUrl)) return true;
      }
    } catch {
      /* Greedy Tap boots with UniLive — keep polling */
    }
    await new Promise((resolve) => window.setTimeout(resolve, HEALTH_POLL_MS));
  }

  // Still open the iframe — user can refresh if the local server is slow.
  return true;
}

export function GreedyTapScreen() {
  const [loading, setLoading] = useState(true);
  const [appUrl] = useState(() => resolveGreedyTapAppUrl());

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setLoading(true);
      await waitForGreedyTapReady();
      if (!cancelled) setLoading(false);
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-black">
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black text-white">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-bold">Starting Greedy Tap…</p>
        </div>
      )}

      {!loading && (
        <iframe
          title="Greedy Tap"
          src={appUrl}
          className="h-full min-h-0 w-full flex-1 border-0 bg-black"
          allow="fullscreen; gamepad; autoplay; clipboard-read; clipboard-write"
        />
      )}
    </div>
  );
}
