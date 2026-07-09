import {
  forwardRef,
  useCallback,
  useRef,
  type VideoHTMLAttributes,
} from 'react';
import { applyMobileInlineVideoAttrs } from '../../lib/nativeVideoPlatform';
import { nativeVideoControlGuardProps } from '../../lib/nativeVideoControls';
import type { PlaybackScope } from '../../lib/playbackScope';

export type AppNativeVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, 'controls'> & {
  /** Native browser controls (default true). Set false for decorative / camera streams. */
  controls?: boolean;
  playbackScope?: PlaybackScope;
  /** Sync global mute when user toggles mute on the native control bar. */
  onGlobalMutedChange?: (muted: boolean) => void;
  controlBarInsetPx?: number;
};

/** User-facing `<video>` — mobile inline attrs, native controls, touch-safe guard props. */
export const AppNativeVideo = forwardRef<HTMLVideoElement, AppNativeVideoProps>(
  function AppNativeVideo(
    {
      controls = true,
      playsInline = true,
      playbackScope,
      onGlobalMutedChange,
      onVolumeChange,
      controlBarInsetPx,
      ...rest
    },
    ref,
  ) {
    const innerRef = useRef<HTMLVideoElement | null>(null);

    const setRef = useCallback(
      (el: HTMLVideoElement | null) => {
        innerRef.current = el;
        if (el) applyMobileInlineVideoAttrs(el);
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      },
      [ref],
    );

    const guardProps = controls ? nativeVideoControlGuardProps(controlBarInsetPx) : {};

    return (
      <video
        ref={setRef}
        controls={controls}
        playsInline={playsInline}
        onVolumeChange={(e) => {
          onVolumeChange?.(e);
          onGlobalMutedChange?.(e.currentTarget.muted);
        }}
        {...rest}
        {...guardProps}
        {...(playbackScope ? { 'data-playback-scope': playbackScope } : null)}
      />
    );
  },
);
