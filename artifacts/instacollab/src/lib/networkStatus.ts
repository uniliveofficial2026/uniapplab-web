/**
 * Lightweight online/offline tracking for offline-first UI.
 * Uses navigator.onLine plus window events; safe for SSR/PWA shells.
 */

export type NetworkStatus = 'online' | 'offline';

type NetworkListener = (status: NetworkStatus) => void;

let status: NetworkStatus =
  typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online';

const listeners = new Set<NetworkListener>();
let installed = false;

function emit(next: NetworkStatus) {
  if (next === status) return;
  status = next;
  for (const listener of listeners) listener(status);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('network-status', { detail: status }));
  }
}

export function isNetworkOnline(): boolean {
  return status === 'online';
}

export function getNetworkStatus(): NetworkStatus {
  return status;
}

export function subscribeNetworkStatus(listener: NetworkListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Wire browser online/offline events once at app boot. */
export function initNetworkStatus(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  status = navigator.onLine === false ? 'offline' : 'online';

  window.addEventListener('online', () => emit('online'));
  window.addEventListener('offline', () => emit('offline'));
}
