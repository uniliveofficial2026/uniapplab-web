/** Fired once when Shell + active tab have painted — safe to hide HTML boot shell. */
export const APP_SHELL_READY_EVENT = 'app-shell-ready';

let shellReady = false;
const listeners = new Set<() => void>();

export function signalAppShellReady(): void {
  if (typeof window === 'undefined' || shellReady) return;
  shellReady = true;
  window.dispatchEvent(new CustomEvent(APP_SHELL_READY_EVENT));
  for (const fn of listeners) {
    try {
      fn();
    } catch (err) {
      console.warn('[app-shell] ready listener failed:', err);
    }
  }
}

export function onAppShellReady(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  if (shellReady) {
    queueMicrotask(fn);
  } else {
    listeners.add(fn);
    window.addEventListener(APP_SHELL_READY_EVENT, fn);
  }
  return () => {
    listeners.delete(fn);
    window.removeEventListener(APP_SHELL_READY_EVENT, fn);
  };
}
