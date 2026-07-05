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
    if (!url) {
      setResolved(fallback);
      return;
    }

    const cached = instantMediaSrc(url, fallback);
    setResolved(cached);

    if (isAppMediaRef(url)) {
      let cancelled = false;
      void hydrateAppMediaUrl(url).then((next) => {
        if (cancelled) return;
        if (next && !isAppMediaRef(next)) setResolved(next);
      });
      const unsub = subscribeAppMediaCache(() => {
        if (!cancelled) setResolved(instantMediaSrc(url, fallback));
      });
      return () => {
        cancelled = true;
        unsub();
      };
    }

    if (url.startsWith('http')) {
      const clear = preferClearMediaUrl(url);
      const hasBlob =
        resolveRemoteMediaUrlSync(clear) || resolveRemoteMediaUrlSync(url);
      if (hasBlob) return undefined;

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
