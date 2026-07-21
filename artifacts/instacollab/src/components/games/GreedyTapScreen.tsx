import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { GREEDY_TAP_APP_URL, greedyTapHealthUrl } from '../../lib/greedyTap/config';

const HEALTH_POLL_MS = 800;
const HEALTH_TIMEOUT_MS = 45_000;

function isGreedyTapHealthPayload(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const record = body as Record<string, unknown>;
  return record.status === 'ok' && typeof record.time === 'string' && typeof record.mode === 'string';
}

async function isGreedyTapStaticReady(): Promise<boolean> {
  try {
    const res = await fetch(GREEDY_TAP_APP_URL, { cache: 'no-store' });
    if (!res.ok) return false;
    const html = await res.text();
    return html.includes('id="root"');
  } catch {
    return false;
  }
}

async function waitForGreedyTapHealth(): Promise<boolean> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const health = await fetch(greedyTapHealthUrl(), { cache: 'no-store' });
      if (health.ok) {
        const body: unknown = await health.json();
        if (isGreedyTapHealthPayload(body)) return true;
      }
    } catch {
      /* keep polling */
    }

    if (!import.meta.env.DEV && (await isGreedyTapStaticReady())) {
      return true;
    }

    await new Promise((resolve) => window.setTimeout(resolve, HEALTH_POLL_MS));
  }
  return false;
}

export function GreedyTapScreen() {
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setLoading(true);
      setReady(false);
      const ok = await waitForGreedyTapHealth();
      if (cancelled) return;
      setReady(ok);
      setLoading(false);
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

      {!loading && !ready && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <p className="max-w-md text-sm font-bold">
            Greedy Tap is still starting. UniLive bundles the game server automatically — give it a
            few more seconds.
          </p>
        </div>
      )}

      {ready && (
        <iframe
          title="Greedy Tap"
          src={GREEDY_TAP_APP_URL}
          className="h-full min-h-0 w-full flex-1 border-0 bg-black"
          allow="fullscreen; gamepad; autoplay; clipboard-read; clipboard-write"
        />
      )}
    </div>
  );
}
