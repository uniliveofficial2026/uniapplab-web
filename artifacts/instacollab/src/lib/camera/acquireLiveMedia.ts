import { WEBAR_CAMERA_FRAME_RATE, WEBAR_CAMERA_IDEAL } from '../webar/webarCameraConfig';
import type { CameraFacingMode } from './useCameraStream';

export type AcquireLiveMediaOptions = {
  video?: boolean;
  audio?: boolean;
  facingMode?: CameraFacingMode;
};

/** Imperative getUserMedia — same constraints as TRTC Beauty AR / CallKit pipeline. */
export async function acquireLiveMediaStream(
  options: AcquireLiveMediaOptions = {},
): Promise<MediaStream> {
  const { video = true, audio = true, facingMode = 'user' } = options;

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera is not supported in this browser.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: video
      ? {
          facingMode,
          width: { ideal: WEBAR_CAMERA_IDEAL.width },
          height: { ideal: WEBAR_CAMERA_IDEAL.height },
          frameRate: WEBAR_CAMERA_FRAME_RATE,
        }
      : false,
    audio,
  });

  stream.getVideoTracks().forEach((track) => {
    track.contentHint = 'motion';
  });

  return stream;
}
