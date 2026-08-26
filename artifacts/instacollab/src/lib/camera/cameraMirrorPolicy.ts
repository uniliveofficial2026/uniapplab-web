import type { CameraFacingMode } from './useCameraStream';

/** Read front/back from track settings — use fallback when WebKit omits facingMode. */
export function readCameraFacingMode(
  track: MediaStreamTrack | null | undefined,
  fallback: CameraFacingMode = 'user',
): CameraFacingMode {
  const facing = track?.getSettings().facingMode;
  if (facing === 'environment' || facing === 'user') return facing;
  return fallback;
}

export function nextCameraFacingMode(current: CameraFacingMode): CameraFacingMode {
  return current === 'user' ? 'environment' : 'user';
}

/** Selfie preview mirrors on front camera only — back camera stays natural. */
export function shouldMirrorCameraPreview(facingMode: CameraFacingMode): boolean {
  return facingMode === 'user';
}

/** Facing mode only changes via Flip — never infer from processed/published tracks. */
export function shouldUpdateCameraFacingFromTrack(
  facingOverride: CameraFacingMode | undefined,
): facingOverride is CameraFacingMode {
  return facingOverride === 'user' || facingOverride === 'environment';
}
