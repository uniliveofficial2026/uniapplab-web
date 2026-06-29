import React from 'react';
import { BackgroundAudioPlayer } from './BackgroundAudioPlayer';
import { PLAYBACK_PRIORITY } from '../../lib/playbackAudio';

type MediaWithSoundtrackProps = {
  soundtrackUrl?: string;
  /** Omit when a parent hoists a single BackgroundAudioPlayer for this post. */
  playbackId?: string;
  playbackPriority?: number;
  /** When false, background audio will not claim playback (e.g. inactive reel). */
  active?: boolean;
  className?: string;
  style?: React.CSSProperties;
  muted?: boolean;
  /** Loop soundtrack on this slide (default true). */
  loopSoundtrack?: boolean;
  children: React.ReactNode;
};

export function MediaWithSoundtrack({
  soundtrackUrl,
  playbackId,
  playbackPriority = PLAYBACK_PRIORITY.FEED,
  active = true,
  className = 'relative w-full h-full',
  style,
  muted = false,
  loopSoundtrack = true,
  children,
}: MediaWithSoundtrackProps) {
  if (!soundtrackUrl || !playbackId) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <div className={className} style={style}>
      <BackgroundAudioPlayer
        audioUrl={soundtrackUrl}
        playbackId={playbackId}
        priority={playbackPriority}
        autoPlay={active}
        muted={muted}
        loop={loopSoundtrack}
      />
      {children}
    </div>
  );
}
