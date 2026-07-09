import { useCallback, useRef } from 'react';

/** Run remote fetch without toggling loading UI — merge results in place, keep last-good on error. */
export function useSilentRemoteRefresh() {
  const inFlightRef = useRef(false);

  return useCallback(async <T>(task: () => Promise<T>, onSuccess: (value: T) => void) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      onSuccess(await task());
    } catch {
      /* silent degrade — caller keeps previous state */
    } finally {
      inFlightRef.current = false;
    }
  }, []);
}

/** Returns true when toast text looks like background sync noise (not user actions). */
export function isSilentSyncToast(message: string): boolean {
  const text = message.trim();
  if (!text) return true;
  return (
    /sync(ed|ing| complete)?/i.test(text) ||
    /refreshed/i.test(text) ||
    /^Signed in!?$/i.test(text) ||
    /Cloud sync/i.test(text) ||
    /Demo synced/i.test(text) ||
    /Loading "/i.test(text) ||
    /Loading accounts/i.test(text) ||
    /Switched account/i.test(text)
  );
}
