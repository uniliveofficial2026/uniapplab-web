export function isCameraPermissionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = 'name' in err ? String(err.name) : '';
  return name === 'NotAllowedError' || name === 'PermissionDeniedError';
}

/** Browser could not find a camera/mic matching constraints (e.g. no back camera on laptop). */
export function isCameraDeviceNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = 'name' in err ? String(err.name) : '';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return true;
  const message = 'message' in err ? String(err.message) : '';
  return /device not found|requested device not found|no device/i.test(message);
}

export function isCameraOverconstrainedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = 'name' in err ? String(err.name) : '';
  return name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError';
}

export function isCameraRetryableError(err: unknown): boolean {
  return (
    isCameraDeviceNotFoundError(err) ||
    isCameraOverconstrainedError(err)
  );
}

export function formatCameraError(err: unknown): string {
  if (isCameraPermissionError(err)) {
    return 'Camera is blocked for this site. Allow camera in the address-bar icon, then tap Retry.';
  }
  if (err instanceof Error && /timed out/i.test(err.message)) {
    return err.message;
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  if (isCameraDeviceNotFoundError(err)) {
    return 'No camera for this browser. Enable this browser under OS Privacy → Camera, then tap Retry.';
  }
  return 'Could not access the camera. Tap Retry.';
}
