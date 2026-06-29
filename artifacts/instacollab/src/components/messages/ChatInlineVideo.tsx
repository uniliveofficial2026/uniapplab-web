import { useCallback, useMemo, useRef, type ReactEventHandler, type ReactNode } from 'react';
import { useDB } from '../../lib/useDB';
import { PLAYBACK_SCOPE } from '../../lib/playbackScope';
import { useInlineVideoVisibility } from '../../lib/useInlineVideoVisibility';
import { useChatMediaVideo } from '../../lib/useChatMediaVideo';
import { safeMediaUrl } from '../../lib/safe';
import {
  mediaReachedEnd,
  useMessageMediaPlaylist,
  useRegisterMessagePlaylistTrack,
} from './MessageMediaPlaylist';

type ChatInlineVideoProps = {
  src: string;
  className?: string;
  videoClassName?: string;
  poster?: string;
  loop?: boolean;
  onError?: ReactEventHandler<HTMLVideoElement>;
  onRegisterRef?: (el: HTMLVideoElement | null) => void;
  overlay?: ReactNode;
  visibilityAutoplay?: boolean;
  /** Messages thread scroll container — visibility is relative to this scroller. */
  scrollRoot?: Element | null;
  /** Keep playing when scrolled off-screen (messages chat default). */
  pauseWhenNotVisible?: boolean;
  playlistTrackId?: string;
};

/** Chat / message-thread inline video — scoped away from feed/reel coordinator. */
export function ChatInlineVideo({
  src,
  className = 'w-full h-full relative bg-black',
  videoClassName = 'w-full h-full object-cover',
  poster,
  loop = false,
  onError,
  onRegisterRef,
  overlay,
  visibilityAutoplay = true,
  scrollRoot = null,
  pauseWhenNotVisible = false,
  playlistTrackId,
}: ChatInlineVideoProps) {
  const db = useDB();
  const playlist = useMessageMediaPlaylist();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { onPlay: onCoordinatorPlay, onBeforeAutoplay } = useChatMediaVideo(videoRef);
  const inPlaylist = Boolean(playlistTrackId && playlist);

  const pauseSelf = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const playFromPlaylist = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.loop = false;
    void video.play().catch(() => {});
  }, []);

  const playlistHandlers = useMemo(
    () =>
      playlistTrackId && playlist
        ? { pause: pauseSelf, playFromPlaylist }
        : null,
    [playlistTrackId, playlist, pauseSelf, playFromPlaylist]
  );

  useRegisterMessagePlaylistTrack(playlistTrackId, playlistHandlers);

  useInlineVideoVisibility(
    containerRef,
    videoRef,
    visibilityAutoplay && !inPlaylist,
    onBeforeAutoplay,
    scrollRoot,
    pauseWhenNotVisible
  );

  const handlePlay = () => {
    if (playlistTrackId && playlist) {
      if (!playlist.consumePlayEvent(playlistTrackId)) return;
      playlist.play(playlistTrackId);
      return;
    }
    onCoordinatorPlay();
  };

  const handleEnded = () => {
    if (playlistTrackId && playlist) {
      playlist.onEnded(playlistTrackId);
    }
  };

  const resolved = safeMediaUrl(src) || src;

  return (
    <div ref={containerRef} className={className}>
      <video
        data-playback-scope={PLAYBACK_SCOPE.INLINE}
        ref={(el) => {
          videoRef.current = el;
          onRegisterRef?.(el);
        }}
        src={resolved}
        className={videoClassName}
        loop={inPlaylist ? false : loop}
        muted={db.globalMuted}
        playsInline
        preload="metadata"
        controls
        poster={poster}
        onError={onError}
        onPlay={handlePlay}
        onPause={() => {
          if (!playlistTrackId || !playlist || !videoRef.current) return;
          if (mediaReachedEnd(videoRef.current)) return;
          playlist.notifyPaused(playlistTrackId);
        }}
        onEnded={handleEnded}
        onVolumeChange={(e) => db.setGlobalMuted(e.currentTarget.muted)}
      />
      {overlay}
    </div>
  );
}
