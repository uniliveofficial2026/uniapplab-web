import { useEffect, useRef, useState } from 'react';
import YouTube, { type YouTubeEvent, type YouTubeProps } from 'react-youtube';
import {
  applyYoutubePlayerVolume,
  stabilizeYoutubePlayerVolume,
  YOUTUBE_PLAYER_VARS,
  type YoutubeIframePlayer,
} from '../../lib/youtubePlayerVolume';
import { buildYoutubeWatchUrl } from '../../services/youtube';

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
  const playerRef = useRef<YoutubeIframePlayer | null>(null);
  readyRef.current = onReady;
  endedRef.current = onEnded;

  useEffect(() => {
    setFailed(false);
  }, [videoId, playlistId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (playerRef.current) stabilizeYoutubePlayerVolume(playerRef.current);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [videoId, playlistId]);

  const opts: YouTubeProps['opts'] = {
    width: '100%',
    height: '100%',
    playerVars: {
      ...YOUTUBE_PLAYER_VARS,
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
          href={buildYoutubeWatchUrl(videoId)}
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
          applyYoutubePlayerVolume(event.target);
          readyRef.current?.();
        }}
        onStateChange={(event: YouTubeEvent) => {
          // 0 = ENDED
          if (event.data === 0) {
            // Native playlist embed: advance inside the iframe (no remount).
            if (playlistId) {
              try {
                const list = event.target.getPlaylist?.() as string[] | undefined;
                const index = event.target.getPlaylistIndex?.() as number | undefined;
                if (Array.isArray(list) && typeof index === 'number') {
                  if (index < list.length - 1) {
                    event.target.nextVideo?.();
                    applyYoutubePlayerVolume(event.target);
                    return;
                  }
                  // Loop the playlist from the start.
                  event.target.playVideoAt?.(0);
                  applyYoutubePlayerVolume(event.target);
                  return;
                }
                event.target.nextVideo?.();
                applyYoutubePlayerVolume(event.target);
                return;
              } catch {
                /* fall through to app queue */
              }
            }
            endedRef.current?.();
          }
          if (event.target) stabilizeYoutubePlayerVolume(event.target);
        }}
        onError={() => {
          setFailed(true);
          onError?.();
        }}
      />
    </div>
  );
}
