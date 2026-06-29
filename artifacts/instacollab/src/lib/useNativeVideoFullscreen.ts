import { useEffect, useState, type RefObject } from 'react';
import {
  isVideoElementNativeFullscreen,
  tryEnterVideoFullscreen,
  tryExitVideoFullscreen,
} from './safe';

/** Track native `<video>` fullscreen (standard API + iOS webkit). */
export function useNativeVideoFullscreen(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled = true
) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setActive(false);
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    const sync = () => setActive(isVideoElementNativeFullscreen(v));
    sync();
    document.addEventListener('fullscreenchange', sync);
    v.addEventListener('webkitbeginfullscreen', sync);
    v.addEventListener('webkitendfullscreen', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      v.removeEventListener('webkitbeginfullscreen', sync);
      v.removeEventListener('webkitendfullscreen', sync);
    };
  }, [enabled, videoRef]);

  return active;
}

export function openNativeVideoFullscreen(
  video: HTMLVideoElement | null | undefined
): void {
  tryEnterVideoFullscreen(video);
}

export function closeNativeVideoFullscreen(
  video: HTMLVideoElement | null | undefined
): void {
  tryExitVideoFullscreen(video);
}

/** Prefer native fullscreen on an existing inline video; returns true if handled. */
export function openNativeVideoFullscreenFromRef(
  getVideo: () => HTMLVideoElement | null | undefined
): boolean {
  const el = getVideo();
  if (!el) return false;
  tryEnterVideoFullscreen(el);
  return true;
}
