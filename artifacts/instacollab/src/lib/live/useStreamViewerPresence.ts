import { useEffect, useState } from 'react';
import { fetchStreamViewers, isPlatformApiAvailable, postStreamViewer } from '../platformApi';

const POLL_MS = 15_000;

/** Report join/leave and poll viewer count for a live platform stream. */
export function useStreamViewerPresence(streamId: string | null, watching: boolean) {
  const [viewers, setViewers] = useState(0);

  useEffect(() => {
    if (!streamId || !watching || !isPlatformApiAvailable()) {
      setViewers(0);
      return undefined;
    }

    let cancelled = false;
    let joined = false;
    let pollTimer: number | null = null;
    const leave = () => postStreamViewer(streamId, 'leave').catch(() => {});

    const refresh = async () => {
      try {
        const data = await fetchStreamViewers(streamId);
        if (!cancelled) setViewers(data.viewers ?? 0);
      } catch {
        /* ignore */
      }
    };

    void (async () => {
      try {
        const data = await postStreamViewer(streamId, 'join');
        if (cancelled) {
          void leave();
          return;
        }
        joined = true;
        if (!cancelled) setViewers(data.viewers ?? 0);
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      pollTimer = window.setInterval(() => {
        void refresh();
      }, POLL_MS);
    })();

    return () => {
      cancelled = true;
      if (pollTimer) window.clearInterval(pollTimer);
      if (joined) {
        joined = false;
        void leave();
      }
    };
  }, [streamId, watching]);

  return viewers;
}

/** Poll viewer count for the host's own live stream. */
export function useHostStreamViewerCount(streamId: string | null) {
  const [viewers, setViewers] = useState(0);

  useEffect(() => {
    if (!streamId || !isPlatformApiAvailable()) {
      setViewers(0);
      return undefined;
    }

    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await fetchStreamViewers(streamId);
        if (!cancelled) setViewers(data.viewers ?? 0);
      } catch {
        /* ignore */
      }
    };

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [streamId]);

  return viewers;
}
