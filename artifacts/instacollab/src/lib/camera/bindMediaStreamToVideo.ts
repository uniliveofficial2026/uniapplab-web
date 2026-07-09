/**
 * Reliable MediaStream → <video> binding used by CallKit, BeautyKit, and live rooms.
 * Prevents frozen/black preview when React remounts or stream tracks are swapped.
 */

import { applyMobileInlineVideoAttrs } from '../nativeVideoPlatform';

export type BindMediaStreamOptions = {
  muted?: boolean;
  /** Re-attach on an interval when the element pauses or loses srcObject. */
  keepAlive?: boolean;
  keepAliveMs?: number;
};

function applyTrackHints(stream: MediaStream) {
  stream.getVideoTracks().forEach((track) => {
    track.contentHint = 'motion';
  });
}

/** Attach stream and wait until frames are playing (or fail fast). */
export async function bindMediaStreamToVideo(
  videoEl: HTMLVideoElement,
  stream: MediaStream | null,
  options: BindMediaStreamOptions = {},
): Promise<void> {
  const { muted = true } = options;

  if (!stream) {
    videoEl.srcObject = null;
    return;
  }

  applyTrackHints(stream);
  applyMobileInlineVideoAttrs(videoEl);
  videoEl.muted = muted;

  if (videoEl.srcObject !== stream) {
    videoEl.srcObject = stream;
  }

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      videoEl.removeEventListener('loadedmetadata', onMetadata);
      videoEl.removeEventListener('playing', onPlaying);
      videoEl.removeEventListener('error', onError);
    };
    const onMetadata = () => {
      void videoEl.play().catch(reject);
    };
    const onPlaying = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Video preview failed to start'));
    };
    videoEl.addEventListener('loadedmetadata', onMetadata);
    videoEl.addEventListener('playing', onPlaying);
    videoEl.addEventListener('error', onError);
    if (videoEl.readyState >= HTMLMediaElement.HAVE_METADATA) {
      void videoEl.play().catch(reject);
    }
  });
}

/** Fire-and-forget attach — resumes play if paused; does not throw. */
export function attachMediaStreamToVideo(
  videoEl: HTMLVideoElement | null,
  stream: MediaStream | null,
  options: BindMediaStreamOptions = {},
): void {
  if (!videoEl) return;
  if (!stream) {
    videoEl.srcObject = null;
    return;
  }
  applyTrackHints(stream);
  applyMobileInlineVideoAttrs(videoEl);
  videoEl.muted = options.muted ?? true;
  if (videoEl.srcObject !== stream) {
    videoEl.srcObject = stream;
  }
  if (videoEl.paused) {
    void videoEl.play().catch(() => undefined);
  }
}

/**
 * React effect helper — retries attach until video mounts, then keeps preview alive.
 * Returns a cleanup function.
 */
export function keepMediaStreamOnVideo(
  videoEl: HTMLVideoElement | null,
  stream: MediaStream | null,
  options: BindMediaStreamOptions = {},
): () => void {
  let rafId = 0;
  let attempts = 0;
  let keepAliveId = 0;

  const tryAttach = () => {
    const el = videoEl;
    if (el && stream) {
      attachMediaStreamToVideo(el, stream, options);
      return;
    }
    if (attempts < 40) {
      attempts += 1;
      rafId = requestAnimationFrame(tryAttach);
    }
  };

  tryAttach();

  if (options.keepAlive !== false) {
    const intervalMs = options.keepAliveMs ?? 2000;
    keepAliveId = window.setInterval(() => {
      const el = videoEl;
      if (!el || !stream) return;
      attachMediaStreamToVideo(el, stream, options);
    }, intervalMs);
  }

  return () => {
    cancelAnimationFrame(rafId);
    window.clearInterval(keepAliveId);
  };
}
