/**
 * Mirror a master call video element into a visible surface (fullscreen or PiP).
 */
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export function useMirrorVideoStream(sourceRef: RefObject<HTMLVideoElement | null>) {
  const mirrorRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const sync = () => {
      const src = sourceRef.current;
      const dst = mirrorRef.current;
      if (!src || !dst) return;
      if (src.srcObject && dst.srcObject !== src.srcObject) {
        dst.srcObject = src.srcObject;
        void dst.play().catch(() => undefined);
      }
    };
    sync();
    const id = window.setInterval(sync, 400);
    return () => window.clearInterval(id);
  }, [sourceRef]);

  return mirrorRef;
}

export async function tryEnterNativeVideoPip(
  video: HTMLVideoElement | null | undefined,
): Promise<boolean> {
  if (!video || typeof document === 'undefined') return false;
  if (!('pictureInPictureEnabled' in document) || !document.pictureInPictureEnabled) {
    return false;
  }
  try {
    if (document.pictureInPictureElement !== video) {
      await video.requestPictureInPicture();
    }
    return true;
  } catch {
    return false;
  }
}

export async function exitNativeVideoPip(): Promise<void> {
  if (typeof document === 'undefined') return;
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    }
  } catch {
    /* ignore */
  }
}
