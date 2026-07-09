import { useEffect, useRef } from 'react';
import type { LiveCloudSurface } from '../lib/liveCloudSurfaces';
import {
  refreshLiveCloudSurface,
  subscribeLiveCloudSurfaceRefresh,
} from '../lib/liveCloudSurfaces';
import { activeSurfacePollIntervalMs } from '../lib/liveCloudSyncMode';
import { isNetworkOnline } from '../lib/networkStatus';

export type UseLiveCloudSurfaceOptions = {
  /** Silent pull when the surface refreshes (realtime event or poll). */
  onSync?: () => void | Promise<void>;
  /** Which refresh events trigger `onSync` (default: current surface + `all`). */
  listen?: LiveCloudSurface[];
  /** Background poll while mounted and tab visible (default: true). */
  poll?: boolean;
};

/**
 * Keeps a screen live: Supabase/Firebase Realtime + coalesced surface refresh + silent poll.
 * UI always paints from local cache first; cloud merges in place with no loaders.
 */
export function useLiveCloudSurface(
  surface: LiveCloudSurface,
  options?: UseLiveCloudSurfaceOptions | (() => void | Promise<void>),
): void {
  const opts: UseLiveCloudSurfaceOptions =
    typeof options === 'function' ? { onSync: options } : options ?? {};
  const listen = opts.listen ?? [surface, 'all'];
  const poll = opts.poll !== false;
  const onSyncRef = useRef(opts.onSync);
  onSyncRef.current = opts.onSync;

  const listenKey = listen.join('|');

  useEffect(() => {
    const runSync = () => {
      void onSyncRef.current?.();
    };

    refreshLiveCloudSurface(surface, { force: true });
    runSync();

    const unsub = subscribeLiveCloudSurfaceRefresh(listen, () => {
      refreshLiveCloudSurface(surface);
      runSync();
    });

    return unsub;
  }, [surface, listenKey]);

  useEffect(() => {
    if (!poll || typeof document === 'undefined') return;

    let timer: number | null = null;

    const armPoll = () => {
      if (timer != null) window.clearInterval(timer);
      timer = null;
      if (document.visibilityState !== 'visible' || !isNetworkOnline()) return;

      const ms = activeSurfacePollIntervalMs();
      if (ms <= 0) return;

      timer = window.setInterval(() => {
        if (document.visibilityState !== 'visible' || !isNetworkOnline()) return;
        refreshLiveCloudSurface(surface);
        void onSyncRef.current?.();
      }, ms);
    };

    armPoll();
    document.addEventListener('visibilitychange', armPoll);
    window.addEventListener('focus', armPoll);

    return () => {
      document.removeEventListener('visibilitychange', armPoll);
      window.removeEventListener('focus', armPoll);
      if (timer != null) window.clearInterval(timer);
    };
  }, [surface, poll]);
}
