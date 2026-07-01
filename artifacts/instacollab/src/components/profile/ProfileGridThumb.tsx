import { Play } from 'lucide-react';
import { handleMediaError } from '../../lib/utils';
import { useResolvedMediaUrl } from '../../hooks/useResolvedMediaUrl';

type ProfileGridThumbProps = {
  thumbUrl: string;
  isVideo?: boolean;
  className?: string;
};

export function ProfileGridThumb({ thumbUrl, isVideo = false, className = '' }: ProfileGridThumbProps) {
  const resolved = useResolvedMediaUrl(thumbUrl);

  if (!resolved) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-zinc-900 text-white/80 ${className}`.trim()}
      >
        {isVideo ? <Play className="h-6 w-6 fill-current" /> : null}
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt="Post"
      className={className}
      loading="lazy"
      onError={handleMediaError}
    />
  );
}
