import { WEBAR_CAMERA_FRAME_RATE, WEBAR_CAMERA_IDEAL } from '../webar/webarCameraConfig';
import {
  acquireAppCamera,
  type CameraFacingMode,
} from './appCameraOwner';

export type AcquireLiveMediaOptions = {
  video?: boolean;
  audio?: boolean;
  facingMode?: CameraFacingMode;
  /** Stable lease id — callers that own the stream for a session should reuse + releaseAppCamera. */
  leaseId?: string;
};

/**
 * Imperative camera acquire through the single app camera owner.
 * Prefer useCameraStream in React; use this for non-hook call sites.
 */
export async function acquireLiveMediaStream(
  options: AcquireLiveMediaOptions = {},
): Promise<MediaStream> {
  const {
    video = true,
    audio = true,
    facingMode = 'user',
    leaseId = `live-media:${Date.now()}`,
  } = options;

  if (!video) {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone is not supported in this browser.');
    }
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }

  return acquireAppCamera(leaseId, {
    facingMode,
    audio,
    videoIdeal: WEBAR_CAMERA_IDEAL,
    frameRate: WEBAR_CAMERA_FRAME_RATE,
    exactFacing: false,
  });
}

export { releaseAppCamera } from './appCameraOwner';
