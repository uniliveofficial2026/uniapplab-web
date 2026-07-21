import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  greedyTapHealthUrl,
  isGreedyTapReadyPayload,
  resolveGreedyTapAppUrl,
} from '../../lib/greedyTap/config';

const HEALTH_POLL_MS = 600;
const HEALTH_TIMEOUT_MS = 20_000;
/** Verified fixed UI — Greedy Tap must show this when the package server is up. */
const LOCAL_FIXED_GREEDY_URL = 'http://127.0.0.1:3000/';

async function probeLocalFixedServer(): Promise<boolean> {
  try {
    const health = await fetch(`${LOCAL_FIXED_GREEDY_URL}api/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });
    if (!health.ok) return false;
    const body: unknown = await health.json();
    return isGreedyTapReadyPayload(body, `${LOCAL_FIXED_GREEDY_URL}api/health`);
  } catch {
    return false;
  }
}

async function waitForUrlReady(healthUrl: string): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const health = await fetch(healthUrl, { cache: 'no-store' });
      if (health.ok) {
        const body: unknown = await health.json();
        if (isGreedyTapReadyPayload(body, healthUrl)) return;
      }
    } catch {
      /* keep polling */
    }
    await new Promise((resolve) => window.setTimeout(resolve, HEALTH_POLL_MS));
  }
}

/**
 * Greedy Tap tab always prefers the fixed package UI at http://127.0.0.1:3000/.
 * Production falls back to the UniLive embed built from that same package.
 */
export function GreedyTapScreen() {
  const [loading, setLoading] = useState(true);
  const [appUrl, setAppUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setLoading(true);

      // 1) Local fixed server (exact UI the user verified).
      if (await probeLocalFixedServer()) {
        if (!cancelled) {
          setAppUrl(LOCAL_FIXED_GREEDY_URL);
          setLoading(false);
        }
        return;
      }

      // 2) Dev: keep targeting :3000 while the package boots with UniLive.
      if (import.meta.env.DEV) {
        await waitForUrlReady(`${LOCAL_FIXED_GREEDY_URL}api/health`);
        if (!cancelled) {
          setAppUrl(LOCAL_FIXED_GREEDY_URL);
          setLoading(false);
        }
        return;
      }

      // 3) Production: same remix build shipped under /games/greedy-slot/.
      const fallback = resolveGreedyTapAppUrl();
      await waitForUrlReady(greedyTapHealthUrl());
      if (!cancelled) {
        setAppUrl(fallback);
        setLoading(false);
      }
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

      {!loading && appUrl && (
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
