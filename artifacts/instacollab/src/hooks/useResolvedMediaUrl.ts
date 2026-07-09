import { useEffect, useState } from 'react';
import {
  hydrateAppMediaUrl,
  isAppMediaRef,
  resolveAppMediaUrlSync,
  resolveRemoteMediaUrlSync,
  subscribeAppMediaCache,
} from '../lib/appMediaStore';
import { instantMediaSrc, preferClearMediaUrl, warmMediaUrl } from '../lib/mediaInstant';

/**
 * Instant clear media URL for img/video/audio.
 * Prefers on-device full-res blobs; never blocks on slow bandwidth.
 */
export function useResolvedMediaUrl(
  url: string | undefined | null,
  fallback = '',
): string {
  const [resolved, setResolved] = useState(() => instantMediaSrc(url, fallback));

  useEffect(() => {
    warmMediaUrl(url);
    return subscribeAppMediaCache(() => setResolved(instantMediaSrc(url, fallback)));
  }, [url, fallback]);

  useEffect(() => {
    if (!url) {
      setResolved(fallback);
      return;
    }

    setResolved(instantMediaSrc(url, fallback));

    if (isAppMediaRef(url)) {
      let cancelled = false;
      void hydrateAppMediaUrl(url).then((next) => {
        if (cancelled) return;
        if (next && !isAppMediaRef(next)) setResolved(next);
      });
      return () => {
        cancelled = true;
      };
    }

    if (url.startsWith('http')) {
      const clear = preferClearMediaUrl(url);
      const cached =
        resolveRemoteMediaUrlSync(clear) || resolveRemoteMediaUrlSync(url);
      if (cached) {
        setResolved(cached);
        return;
      }
      // Network URL paints immediately; warmMediaUrl upgrades to blob when ready.
      setResolved(clear);
      warmMediaUrl(url);
      const unsub = subscribeAppMediaCache(() => {
        const next =
          resolveRemoteMediaUrlSync(clear) || resolveRemoteMediaUrlSync(url);
        if (next) setResolved(next);
      });
      return unsub;
    }

    return undefined;
  }, [url, fallback]);

  return resolved;
}
