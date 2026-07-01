import { useEffect, useState } from 'react';
import {
  hydrateAppMediaUrl,
  isAppMediaRef,
  resolveAppMediaUrlSync,
  subscribeAppMediaCache,
} from '../lib/appMediaStore';

function resolveForDom(url: string | undefined | null): string {
  if (!url) return '';
  const sync = resolveAppMediaUrlSync(url);
  if (isAppMediaRef(sync)) return '';
  return sync;
}

/** Resolve app-media refs to blob URLs for img/video/audio src. Never exposes app-media: to the DOM. */
export function useResolvedMediaUrl(url: string | undefined | null): string {
  const [resolved, setResolved] = useState(() => resolveForDom(url));

  useEffect(() => subscribeAppMediaCache(() => setResolved(resolveForDom(url))), [url]);

  useEffect(() => {
    if (!url) {
      setResolved('');
      return;
    }

    const sync = resolveForDom(url);
    if (sync) {
      setResolved(sync);
      return;
    }

    if (!isAppMediaRef(url)) {
      setResolved(url);
      return;
    }

    let cancelled = false;
    void hydrateAppMediaUrl(url).then(() => {
      if (!cancelled) setResolved(resolveForDom(url));
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return resolved;
}
