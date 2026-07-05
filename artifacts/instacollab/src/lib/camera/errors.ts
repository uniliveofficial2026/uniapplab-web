export function isCameraPermissionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = 'name' in err ? String(err.name) : '';
  return name === 'NotAllowedError' || name === 'PermissionDeniedError';
}
