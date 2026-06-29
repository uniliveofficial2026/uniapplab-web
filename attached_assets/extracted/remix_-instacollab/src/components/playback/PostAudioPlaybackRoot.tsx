import React, { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { isPlayableAudioUrl } from '../../lib/audioMedia';
import {
  bindPostCanonicalAudio,
  getPostAudioEntry,
  usePostAudioRegistry,
} from '../../lib/postAudioRegistry';

function CanonicalPostAudio({
  postId,
  surface,
  audioUrl,
  loop,
  onEnded,
}: {
  postId: string;
  surface: 'soundtrack' | 'text-audio';
  audioUrl: string;
  loop: boolean;
  onEnded?: () => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);

  useLayoutEffect(() => {
    bindPostCanonicalAudio(postId, surface, ref.current);
    return () => bindPostCanonicalAudio(postId, surface, null);
  }, [postId, surface, audioUrl]);

  return (
    <audio
      ref={ref}
      src={audioUrl}
      loop={loop}
      playsInline
      preload="auto"
      muted={getPostAudioEntry(postId)?.muted ?? false}
      onEnded={onEnded}
      className="sr-only"
      aria-hidden
    />
  );
}

/** Single shared audio elements per post (mounted once, never remounted on modal open). */
export function PostAudioPlaybackRoot() {
  const registry = usePostAudioRegistry();

  return createPortal(
    <>
      {[...registry.entries()].map(([postId, entry]) => (
        <React.Fragment key={postId}>
          {entry.soundtrackUrl && isPlayableAudioUrl(entry.soundtrackUrl) && (
            <CanonicalPostAudio
              postId={postId}
              surface="soundtrack"
              audioUrl={entry.soundtrackUrl}
              loop={entry.loop}
              onEnded={entry.onEnded}
            />
          )}
          {entry.textAudioUrl && isPlayableAudioUrl(entry.textAudioUrl) && (
            <CanonicalPostAudio
              postId={postId}
              surface="text-audio"
              audioUrl={entry.textAudioUrl}
              loop={entry.loop}
            />
          )}
        </React.Fragment>
      ))}
    </>,
    document.body
  );
}
