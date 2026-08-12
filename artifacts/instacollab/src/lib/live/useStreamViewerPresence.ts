import { useEffect, useRef, useState } from 'react';
import { fetchStreamViewers, isPlatformApiAvailable, postStreamViewer } from '../platformApi';
import { realtimeLifecycleDebug } from '../realtime/realtimeLifecycleDebug';

const POLL_MS = 3_000;

/** Report join/leave and poll viewer count for a live platform stream. */
export function useStreamViewerPresence(streamId: string | null, watching: boolean) {
  const [viewers, setViewers] = useState(0);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!streamId || !watching || !isPlatformApiAvailable()) {
      setViewers(0);
      return undefined;
    }

    let cancelled = false;
    let pollTimer: number | null = null;
    const activeStreamId = streamId;

    const refresh = async () => {
      try {
        const data = await fetchStreamViewers(activeStreamId);
        if (!cancelled) setViewers(data.viewers ?? 0);
      } catch {
        /* ignore */
      }
    };

    void (async () => {
      try {
        const data = await postStreamViewer(activeStreamId, 'join');
        if (cancelled) {
          // Stale async join after leave/unmount — deregister immediately.
          void postStreamViewer(activeStreamId, 'leave').catch(() => {});
          realtimeLifecycleDebug('stream-viewer-stale-join-rolled-back', {
            streamId: activeStreamId,
          });
          return;
        }
        joinedRef.current = true;
        setViewers(data.viewers ?? 0);
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
      if (joinedRef.current) {
        joinedRef.current = false;
        void postStreamViewer(activeStreamId, 'leave').catch(() => {});
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
