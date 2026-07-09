import React, { useEffect, useState } from 'react';
import { FALLBACK_MEDIA } from '../../lib/safe';
import {
  instantMediaSrc,
  warmMediaUrl,
} from '../../lib/mediaInstant';
import {
  isAppMediaRef,
  resolveAppMediaUrlSync,
  subscribeAppMediaCache,
  hydrateAppMediaUrl,
} from '../../lib/appMediaStore';
import { handleMediaError } from '../../lib/utils';

type SafeMediaImageProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  fallback?: string;
  loading?: 'lazy' | 'eager';
  /** Prefer eager for above-the-fold / live posters. */
  priority?: boolean;
};

/**
 * Instant image: shows fallback or cached blob immediately, upgrades when ready.
 * Never waits on a slow network to paint.
 */
export function SafeMediaImage({
  src,
  alt = '',
  className = '',
  fallback = FALLBACK_MEDIA,
  loading = 'lazy',
  priority = false,
}: SafeMediaImageProps) {
  const [display, setDisplay] = useState(() => instantMediaSrc(src, fallback));

  useEffect(() => {
    const initial = instantMediaSrc(src, fallback);
    setDisplay(initial);
    warmMediaUrl(src);

    if (!src) return;

    if (isAppMediaRef(src)) {
      const sync = resolveAppMediaUrlSync(src);
      if (sync && !isAppMediaRef(sync)) {
        setDisplay(sync);
        return;
      }
      let cancelled = false;
      const unsub = subscribeAppMediaCache(() => {
        const next = resolveAppMediaUrlSync(src);
        if (next && !isAppMediaRef(next) && !cancelled) setDisplay(next);
      });
      void hydrateAppMediaUrl(src).then((next) => {
        if (!cancelled && next && !isAppMediaRef(next)) setDisplay(next);
      });
      return () => {
        cancelled = true;
        unsub();
      };
    }

    setDisplay(src);
    return undefined;
  }, [src, fallback]);

  return (
    <img
      src={display || fallback}
      alt={alt}
      className={className}
      loading={priority ? 'eager' : loading}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : undefined}
      onError={(e) => {
        const el = e.currentTarget;
        if (el.src === fallback || el.getAttribute('data-media-fallback') === '1') {
          handleMediaError(e);
          return;
        }
        el.setAttribute('data-media-fallback', '1');
        el.src = fallback;
      }}
    />
  );
}
