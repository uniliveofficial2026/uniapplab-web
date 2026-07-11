import { useEffect, useRef, useState } from 'react';
import YouTube, { type YouTubeEvent, type YouTubeProps } from 'react-youtube';
import { buildYoutubeEmbedUrl } from '../../services/youtube';

type WatchTogetherYoutubePlayerProps = {
  videoId: string;
  /** When set, YouTube advances through the playlist natively. */
  playlistId?: string | null;
  title?: string;
  onReady?: () => void;
  onEnded?: () => void;
  onError?: () => void;
  className?: string;
};

/** Keep mini-player audio at full volume — never duck when the host speaks. */
function lockPlayerVolume(player: { setVolume?: (n: number) => void; unMute?: () => void; isMuted?: () => boolean }) {
  try {
    player.unMute?.();
    player.setVolume?.(100);
  } catch {
    /* ignore */
  }
}

export function WatchTogetherYoutubePlayer({
  videoId,
  playlistId = null,
  title,
  onReady,
  onEnded,
  onError,
  className = '',
}: WatchTogetherYoutubePlayerProps) {
  const [failed, setFailed] = useState(false);
  const readyRef = useRef(onReady);
  const endedRef = useRef(onEnded);
  const playerRef = useRef<{ setVolume?: (n: number) => void; unMute?: () => void } | null>(null);
  readyRef.current = onReady;
  endedRef.current = onEnded;

  useEffect(() => {
    setFailed(false);
  }, [videoId, playlistId]);

  // Re-assert full volume periodically so speaking / AGC never ducks the mini player.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (playerRef.current) lockPlayerVolume(playerRef.current);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [videoId, playlistId]);

  const opts: YouTubeProps['opts'] = {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 1,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      ...(playlistId
        ? {
            listType: 'playlist' as const,
            list: playlistId,
          }
        : {}),
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
        onReady={(event: YouTubeEvent) => {
          setFailed(false);
          playerRef.current = event.target;
          lockPlayerVolume(event.target);
          readyRef.current?.();
        }}
        onStateChange={(event: YouTubeEvent) => {
          // 0 = ENDED
          if (event.data === 0) {
            endedRef.current?.();
          }
          // Keep volume full after any state change (play / buffer / unpause).
          if (event.target) lockPlayerVolume(event.target);
        }}
        onError={() => {
          setFailed(true);
          onError?.();
        }}
      />
    </div>
  );
}
