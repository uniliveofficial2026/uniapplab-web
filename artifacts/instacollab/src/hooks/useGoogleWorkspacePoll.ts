import { useEffect, useRef } from 'react';
import { googleWorkspacePollIntervalMs } from '../lib/liveCloudSyncMode';
import { isNetworkOnline } from '../lib/networkStatus';

/** Silent periodic refresh for Google Workspace tabs (Gmail, Calendar, etc.). */
export function useGoogleWorkspacePoll(
  fetch: () => void | Promise<void>,
  enabled: boolean,
): void {
  const fetchRef = useRef(fetch);
  fetchRef.current = fetch;

  useEffect(() => {
    if (!enabled) return;

    void fetchRef.current();

    let timer: number | null = null;

    const arm = () => {
      if (timer != null) window.clearInterval(timer);
      timer = null;
      if (document.visibilityState !== 'visible' || !isNetworkOnline()) return;

      const ms = googleWorkspacePollIntervalMs();
      if (ms <= 0) return;

      timer = window.setInterval(() => {
        if (document.visibilityState !== 'visible' || !isNetworkOnline()) return;
        void fetchRef.current();
      }, ms);
    };

    arm();
    document.addEventListener('visibilitychange', arm);
    window.addEventListener('focus', arm);

    return () => {
      document.removeEventListener('visibilitychange', arm);
      window.removeEventListener('focus', arm);
      if (timer != null) window.clearInterval(timer);
    };
  }, [enabled]);
}
