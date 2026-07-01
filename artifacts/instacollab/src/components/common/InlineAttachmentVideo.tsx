import { useRef, type ReactEventHandler } from 'react';
import { useDB } from '../../lib/useDB';
import { PLAYBACK_SCOPE } from '../../lib/playbackScope';
import { useInlineVideoVisibility } from '../../lib/useInlineVideoVisibility';
import { nativeVideoControlGuardProps } from '../../lib/nativeVideoControls';

type InlineAttachmentVideoProps = {
  src: string;
  className?: string;
  videoClassName?: string;
  loop?: boolean;
  onRegisterRef?: (el: HTMLVideoElement | null) => void;
  onError?: ReactEventHandler<HTMLVideoElement>;
};

/**
 * Small inline video (comments, chat) — autoplays when scrolled into view;
 * does not fight feed/reel managed playback.
 */
export function InlineAttachmentVideo({
  src,
  className = '',
  videoClassName = 'w-full h-full object-cover',
  loop = true,
  onRegisterRef,
  onError,
}: InlineAttachmentVideoProps) {
  const db = useDB();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useInlineVideoVisibility(containerRef, videoRef, true);

  return (
    <div ref={containerRef} className={className}>
      <video
        data-playback-scope={PLAYBACK_SCOPE.INLINE}
        ref={(el) => {
          videoRef.current = el;
          onRegisterRef?.(el);
        }}
        src={src}
        muted={db.globalMuted}
        playsInline
        preload="metadata"
        controls
        loop={loop}
        onVolumeChange={(e) => {
          db.setGlobalMuted(e.currentTarget.muted);
        }}
        onError={onError}
        {...nativeVideoControlGuardProps()}
        className={videoClassName}
      />
    </div>
  );
}
