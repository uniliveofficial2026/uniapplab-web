/** Shared flag so wallet sync can skip writes during remote cloud apply (avoids import cycles). */
let applyingRemote = false;

export function isCloudAppStateRemoteApply(): boolean {
  return applyingRemote;
}

export function withCloudAppStateRemoteApply<T>(fn: () => T): T {
  applyingRemote = true;
  try {
    return fn();
  } finally {
    applyingRemote = false;
  }
}
