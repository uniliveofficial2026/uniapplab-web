/** Global handlers so stray promise rejections do not fail silently in production. */
export function installRuntimeGuards(): void {
  if (typeof window === 'undefined') return;

  const isBenignCloudNoise = (reason: unknown): boolean => {
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : String(reason ?? '');
    return (
      /Failed to get document because the client is offline/i.test(message) ||
      /client is offline/i.test(message) ||
      /cannot add `postgres_changes` callbacks/i.test(message) ||
      /WebChannelConnection.*transport errored/i.test(message) ||
      /NETWORK_ERROR/i.test(message) ||
      /FetchError/i.test(message) ||
      /Load failed/i.test(message) ||
      /Failed to fetch/i.test(message) ||
      /QuotaExceededError/i.test(message) ||
      /exceeded the quota/i.test(message) ||
      /INTERNAL ASSERTION FAILED/i.test(message) ||
      /firestore_clients_/i.test(message)
    );
  };

  const recoverFirestoreStorageQuota = (reason: unknown): void => {
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : String(reason ?? '');
    if (
      !/QuotaExceededError|exceeded the quota|firestore_clients_|INTERNAL ASSERTION FAILED/i.test(
        message,
      )
    ) {
      return;
    }
    void import('./firebase/app')
      .then((m) => {
        const removed = m.purgeFirestoreWebStorage();
        if (removed > 0 && import.meta.env.DEV) {
          console.warn(`[app] purged ${removed} Firestore localStorage key(s) after quota error`);
        }
      })
      .catch(() => {
        /* ignore */
      });
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (isBenignCloudNoise(event.reason)) {
      recoverFirestoreStorageQuota(event.reason);
      // Prevent Vite/runtime overlay + ErrorBoundary noise from blanking the UI.
      event.preventDefault();
      return;
    }
    console.error('[app] unhandled rejection:', event.reason);
  });

  window.addEventListener('error', (event) => {
    const payload = event.error ?? event.message;
    const msg =
      payload instanceof Error
        ? payload.message
        : typeof payload === 'string'
          ? payload
          : String(payload ?? '');
    // Cap Browser.close / opaque cross-origin noise — never blank the shell.
    if (
      /^Script error\.?$/i.test(msg) ||
      /No active window to close/i.test(msg)
    ) {
      event.preventDefault();
      return;
    }
    if (isBenignCloudNoise(payload)) {
      recoverFirestoreStorageQuota(payload);
      event.preventDefault();
      return;
    }
    console.error('[app] uncaught error:', payload);
  });
}
