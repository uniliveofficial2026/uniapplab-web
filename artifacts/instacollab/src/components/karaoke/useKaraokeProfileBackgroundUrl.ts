import { useEffect, useState } from 'react';
import type { KaraokeProfileBackgroundMediaKind } from '../../lib/karaokeProfileBackground';
import { resolveKaraokeProfileBackgroundPlayableUrl } from '../../lib/karaokeProfileBackground';

export function useKaraokeProfileBackgroundUrl(options: {
  url?: string | null;
  mediaId?: string | null;
  mediaKind?: KaraokeProfileBackgroundMediaKind;
  mimeType?: string;
}) {
  const [playableUrl, setPlayableUrl] = useState<string | null>(options.url ?? null);
  const [loading, setLoading] = useState(Boolean(options.mediaId && !options.url));

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      if (!options.url && !options.mediaId) {
        setPlayableUrl(null);
        setLoading(false);
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
          mediaKind: options.mediaKind ?? 'video',
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
