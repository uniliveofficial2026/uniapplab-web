import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Music } from 'lucide-react';
import { isPlayableAudioUrl } from '../../lib/audioMedia';
import { useResolvedMediaUrl } from '../../hooks/useResolvedMediaUrl';
import {
  clearPlaybackIntent,
  PLAYBACK_PRIORITY,
  registerPlaybackElement,
  setPlaybackIntent,
} from '../../lib/playbackAudio';

type BackgroundAudioPlayerProps = {
  audioUrl?: string;
  /** Unique id across feed / modal / fullscreen / reels / story. */
  playbackId: string;
  /** Distinguishes feed vs modal when sharing the same playbackId. */
  intentKey?: string;
  priority?: number;
  /** When false, this surface will not claim playback. */
  autoPlay?: boolean;
  /** When false, audio keeps playing but controls are hidden (feed text posts). */
  showControls?: boolean;
  className?: string;
  muted?: boolean;
  /** Loop this file; set false when parent carousel advances on ended. */
  loop?: boolean;
  onEnded?: () => void;
};

export function BackgroundAudioPlayer({
  audioUrl,
  playbackId,
  intentKey = 'background',
  priority = PLAYBACK_PRIORITY.FEED,
  showControls = false,
  className = '',
  autoPlay = true,
  muted = false,
  loop = true,
  onEnded,
}: BackgroundAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const resolvedAudioUrl = useResolvedMediaUrl(audioUrl);
  const playable = isPlayableAudioUrl(audioUrl);
  const wantsPlay = autoPlay && !muted && playable;

  useLayoutEffect(() => {
    registerPlaybackElement(playbackId, intentKey, audioRef.current);
    return () => registerPlaybackElement(playbackId, intentKey, null);
  }, [playbackId, intentKey, playable, audioUrl]);

  useEffect(() => {
    setPlaybackIntent(playbackId, intentKey, priority, wantsPlay);
    return () => clearPlaybackIntent(playbackId, intentKey);
  }, [playbackId, intentKey, priority, wantsPlay]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = muted;
  }, [muted, playable, audioUrl]);

  if (!playable || !audioUrl) return null;

  if (!showControls) {
    return (
      <audio
        ref={audioRef}
        src={resolvedAudioUrl || audioUrl || undefined}
        loop={loop}
        playsInline
        preload="auto"
        muted={muted}
        onEnded={onEnded}
        className={`sr-only ${className}`.trim()}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-border bg-background/90 px-2 py-1.5 ${className}`.trim()}
    >
      <Music className="h-3.5 w-3.5 shrink-0 text-primary" />
      <audio
        ref={audioRef}
        src={resolvedAudioUrl || audioUrl || undefined}
        loop={loop}
        playsInline
        controls
        preload="auto"
        muted={muted}
        onEnded={onEnded}
        className="h-8 max-w-[220px] flex-1 accent-primary"
      />
    </div>
  );
}
