import { useSyncExternalStore } from 'react';

const SCROLL_SETTLE_MS = 200;

let feedScrolling = false;
let scrollEndTimer: ReturnType<typeof setTimeout> | null = null;
let listenerCount = 0;
const listeners = new Set<() => void>();

function emitScrollChange() {
  listeners.forEach((listener) => listener());
}

function setFeedScrolling(next: boolean) {
  if (feedScrolling === next) return;
  feedScrolling = next;
  if (typeof document !== 'undefined') {
    if (next) {
      document.body.dataset.feedScrolling = 'true';
    } else {
      delete document.body.dataset.feedScrolling;
    }
  }
  emitScrollChange();
}

function onScrollCapture() {
  if (!feedScrolling) setFeedScrolling(true);
  if (scrollEndTimer) clearTimeout(scrollEndTimer);
  scrollEndTimer = setTimeout(() => {
    scrollEndTimer = null;
    setFeedScrolling(false);
  }, SCROLL_SETTLE_MS);
}

function attachGlobalScrollListener() {
  if (typeof document === 'undefined') return () => {};
  document.addEventListener('scroll', onScrollCapture, { passive: true, capture: true });
  return () => {
    document.removeEventListener('scroll', onScrollCapture, { capture: true } as AddEventListenerOptions);
    if (scrollEndTimer) {
      clearTimeout(scrollEndTimer);
      scrollEndTimer = null;
    }
    setFeedScrolling(false);
  };
}

function subscribeFeedScrolling(listener: () => void) {
  listeners.add(listener);
  listenerCount += 1;
  const detach = listenerCount === 1 ? attachGlobalScrollListener() : () => {};
  return () => {
    listeners.delete(listener);
    listenerCount = Math.max(0, listenerCount - 1);
    if (listenerCount === 0) detach();
  };
}

export function isFeedScrolling(): boolean {
  return feedScrolling;
}

/** True while the user is actively scrolling any in-app surface (feed main, story strip, etc.). */
export function useFeedScrolling(): boolean {
  return useSyncExternalStore(
    subscribeFeedScrolling,
    isFeedScrolling,
    () => false,
  );
}
