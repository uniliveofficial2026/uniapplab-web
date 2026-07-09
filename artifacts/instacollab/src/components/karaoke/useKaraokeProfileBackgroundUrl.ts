import { useEffect, useState } from 'react';
import type { KaraokeProfileBackgroundMediaKind } from '../../lib/karaokeProfileBackground';
import { resolveKaraokeProfileBackgroundPlayableUrl } from '../../lib/karaokeProfileBackground';

export function useKaraokeProfileBackgroundUrl(options: {
  url?: string | null;
  mediaId?: string | null;
  mediaKind?: KaraokeProfileBackgroundMediaKind;
  mimeType?: string;
}) {
  const [playableUrl, setPlayableUrl] = useState<string | null>(options.url || null);
  const [loading, setLoading] = useState(
    Boolean(options.mediaId && (!options.url || options.mediaKind === 'video')),
  );

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      if (!options.url && !options.mediaId) {
        setPlayableUrl(null);
        setLoading(false);
        return;
      }

      // Persisted videos clear their blob URL on save — always reload from IndexedDB.
      if (options.mediaKind === 'video' && options.mediaId) {
        setLoading(true);
        try {
          const resolved = await resolveKaraokeProfileBackgroundPlayableUrl({
            url: '',
            mediaId: options.mediaId,
            mediaKind: 'video',
            mimeType: options.mimeType,
          });
          if (!cancelled) {
            setPlayableUrl(resolved || options.url || null);
          }
        } catch {
          if (!cancelled) setPlayableUrl(options.url || null);
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      if (options.url) {
        setPlayableUrl(options.url);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const resolved = await resolveKaraokeProfileBackgroundPlayableUrl({
          url: '',
          mediaId: options.mediaId ?? undefined,
          mediaKind: options.mediaKind ?? 'image',
          mimeType: options.mimeType,
        });
        if (!cancelled) setPlayableUrl(resolved);
      } catch {
        if (!cancelled) setPlayableUrl(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [options.url, options.mediaId, options.mediaKind, options.mimeType]);

  return { playableUrl, loading };
}
