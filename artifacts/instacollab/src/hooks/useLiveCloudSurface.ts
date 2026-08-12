import { useEffect, useRef } from 'react';
import type { LiveCloudSurface } from '../lib/liveCloudSurfaces';
import {
  refreshLiveCloudSurface,
  subscribeLiveCloudSurfaceRefresh,
} from '../lib/liveCloudSurfaces';
import { activeSurfacePollIntervalMs } from '../lib/liveCloudSyncMode';
import { isNetworkOnline } from '../lib/networkStatus';
import { useKeepAliveTabActive } from '../lib/keepAliveTabContext';

export type UseLiveCloudSurfaceOptions = {
  /** Silent pull when the surface refreshes (realtime event or poll). */
  onSync?: () => void | Promise<void>;
  /** Which refresh events trigger `onSync` (default: current surface + `all`). */
  listen?: LiveCloudSurface[];
  /** Background poll while mounted and tab visible (default: false — Realtime is primary). */
  poll?: boolean;
};

/**
 * Keeps a screen live: Supabase/Firebase Realtime + coalesced surface refresh.
 * Inactive KeepAlive tabs do not refresh or poll (was freezing the whole app).
 */
export function useLiveCloudSurface(
  surface: LiveCloudSurface,
  options?: UseLiveCloudSurfaceOptions | (() => void | Promise<void>),
): void {
  const opts: UseLiveCloudSurfaceOptions =
    typeof options === 'function' ? { onSync: options } : options ?? {};
  const listen = opts.listen ?? [surface, 'all'];
  const poll = opts.poll === true;
  const onSyncRef = useRef(opts.onSync);
  onSyncRef.current = opts.onSync;
  const tabActive = useKeepAliveTabActive();

  const listenKey = listen.join('|');

  useEffect(() => {
    if (!tabActive) return undefined;

    const runSync = () => {
      void onSyncRef.current?.();
    };

    // Soft refresh — Shell also warms the active tab; avoid force stampede.
    refreshLiveCloudSurface(surface);
    runSync();

    const unsub = subscribeLiveCloudSurfaceRefresh(listen, runSync);
    return unsub;
  }, [surface, listenKey, tabActive]);

  useEffect(() => {
    if (!poll || !tabActive || typeof document === 'undefined') return undefined;

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
  }, [surface, poll, tabActive]);
}
