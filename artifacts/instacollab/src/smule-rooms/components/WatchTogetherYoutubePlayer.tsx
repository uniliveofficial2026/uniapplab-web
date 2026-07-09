import { useEffect, useRef, useState } from 'react';
import YouTube, { type YouTubeProps } from 'react-youtube';
import { buildYoutubeEmbedUrl } from '../../services/youtube';

type WatchTogetherYoutubePlayerProps = {
  videoId: string;
  title?: string;
  onReady?: () => void;
  onError?: () => void;
  className?: string;
};

export function WatchTogetherYoutubePlayer({
  videoId,
  title,
  onReady,
  onError,
  className = '',
}: WatchTogetherYoutubePlayerProps) {
  const [failed, setFailed] = useState(false);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    setFailed(false);
  }, [videoId]);

  const opts: YouTubeProps['opts'] = {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 1,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
    },
  };

  if (failed) {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center gap-3 bg-black px-4 text-center ${className}`}>
        <p className="text-xs font-bold text-red-300">This YouTube video could not be embedded.</p>
        <a
          href={buildYoutubeEmbedUrl(videoId).replace('/embed/', '/watch?v=')}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-red-400/40 bg-red-500/15 px-3 py-1 text-[10px] font-black text-red-200"
        >
          Open on YouTube
        </a>
      </div>
    );
  }

  return (
    <div className={`watch-together-youtube-player relative h-full w-full bg-black ${className}`}>
      <YouTube
        videoId={videoId}
        opts={opts}
        className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full"
        title={title || 'YouTube video'}
        onReady={() => {
          setFailed(false);
          readyRef.current?.();
        }}
        onError={() => {
          setFailed(true);
          onError?.();
        }}
      />
    </div>
  );
}
