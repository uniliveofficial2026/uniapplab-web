import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { resolveGreedyTapAppUrl } from '../../lib/greedyTap/config';

/**
 * Verified fixed UI from the remix package server.
 * Greedy Tap tab must show this on local UniLive (`localhost:5173/greedy-tap`).
 */
const LOCAL_FIXED_GREEDY_URL = 'http://127.0.0.1:3000/';

/**
 * Greedy Tap tab:
 * - Local: always iframe the fixed package at :3000 (no CORS health gate).
 * - Production: UniLive embed built from that same package.
 */
export function GreedyTapScreen() {
  const [loading, setLoading] = useState(true);
  const [appUrl, setAppUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setLoading(true);

      if (import.meta.env.DEV) {
        // Do not fetch :3000 from the browser — cross-origin health checks hang
        // behind CORS and leave this screen on “Starting…”. The iframe itself
        // loads cross-origin fine.
        if (!cancelled) {
          setAppUrl(LOCAL_FIXED_GREEDY_URL);
          setLoading(false);
        }
        return;
      }

      const fallback = resolveGreedyTapAppUrl();
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
