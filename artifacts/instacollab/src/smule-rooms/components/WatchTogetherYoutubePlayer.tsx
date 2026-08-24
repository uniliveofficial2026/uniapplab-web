import { useEffect, useRef, useState } from 'react';
import YouTube, { type YouTubeEvent, type YouTubeProps } from 'react-youtube';
import {
  applyYoutubePlayerVolume,
  resumeYoutubePlaybackAfterAutoplay,
  stabilizeYoutubePlayerVolume,
  youtubeIframePlayerVars,
  type YoutubeIframePlayer,
} from '../../lib/youtubePlayerVolume';
import { buildYoutubeWatchUrl } from '../../services/youtube';

type WatchTogetherYoutubePlayerProps = {
  videoId: string;
  /** When set, YouTube advances through the playlist natively. */
  playlistId?: string | null;
  title?: string;
  onReady?: (player: YoutubeIframePlayer) => void;
  onEnded?: () => void;
  onError?: (code?: number) => void;
  className?: string;
  /** Keep playback muted (live vertical feed). */
  forceMute?: boolean;
  /** Seek to this timestamp when it changes (chapters). */
  seekToSeconds?: number | null;
  playerVars?: Record<string, string | number | undefined>;
};

export function WatchTogetherYoutubePlayer({
  videoId,
  playlistId = null,
  title,
  onReady,
  onEnded,
  onError,
  className = '',
  forceMute = false,
  seekToSeconds = null,
  playerVars,
}: WatchTogetherYoutubePlayerProps) {
  const [failed, setFailed] = useState(false);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const readyRef = useRef(onReady);
  const endedRef = useRef(onEnded);
  const playerRef = useRef<YoutubeIframePlayer | null>(null);
  readyRef.current = onReady;
  endedRef.current = onEnded;

  useEffect(() => {
    setFailed(false);
    setErrorCode(null);
  }, [videoId, playlistId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (playerRef.current) stabilizeYoutubePlayerVolume(playerRef.current);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [videoId, playlistId]);

  useEffect(() => {
    if (seekToSeconds == null || !Number.isFinite(seekToSeconds)) return;
    try {
      playerRef.current?.seekTo?.(seekToSeconds, true);
      playerRef.current?.playVideo?.();
    } catch {
      /* player not ready */
    }
  }, [seekToSeconds]);

  const opts: YouTubeProps['opts'] = {
    width: '100%',
    height: '100%',
    host: 'https://www.youtube.com',
    playerVars: youtubeIframePlayerVars({
      autoplay: 1,
      mute: 1,
      ...(playlistId
        ? {
            listType: 'playlist',
            list: playlistId,
          }
        : {}),
      ...playerVars,
    }),
  };

  if (failed) {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center gap-3 bg-black px-4 text-center ${className}`}>
        <p className="text-xs font-bold text-red-300">
          {errorCode === 101 || errorCode === 150
            ? 'This video cannot be embedded.'
            : errorCode === 100
              ? 'This YouTube video is unavailable.'
              : 'This YouTube video could not be embedded.'}
        </p>
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
    <div className={`watch-together-youtube-player relative h-full w-full min-h-[180px] bg-black ${className}`}>
      <YouTube
        key={`${videoId}:${playlistId || ''}`}
        videoId={videoId}
        opts={opts}
        className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full"
        iframeClassName="h-full w-full"
        title={title || 'YouTube video'}
        onReady={(event: YouTubeEvent) => {
          setFailed(false);
          playerRef.current = event.target as YoutubeIframePlayer;
          applyYoutubePlayerVolume(event.target);
          try {
            event.target.playVideo?.();
          } catch {
            /* autoplay */
          }
          readyRef.current?.(event.target as YoutubeIframePlayer);
        }}
        onStateChange={(event: YouTubeEvent) => {
          // 0 = ENDED, 1 = PLAYING
          if (event.data === 1 && !forceMute) {
            resumeYoutubePlaybackAfterAutoplay(event.target);
          }
          if (event.data === 0) {
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
        onError={(event: YouTubeEvent) => {
          const code = typeof event.data === 'number' ? event.data : undefined;
          setErrorCode(code ?? null);
          setFailed(true);
          onError?.(code);
        }}
      />
    </div>
  );
}
