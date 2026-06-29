import { useEffect, useRef, useSyncExternalStore, type MouseEvent, type PointerEvent } from 'react';
import { db } from './db';

/** How long to ignore backdrop-close after opening (ghost click from tap-to-open). */
export const FULLSCREEN_OPEN_GUARD_MS = 500;

let overlayLockCount = 0;
const overlayListeners = new Set<() => void>();

function emitOverlayChange() {
  overlayListeners.forEach((l) => l());
}

/** Register an in-app media fullscreen overlay (post, reel, modal, chat, story, etc.). */
export function acquireMediaOverlayLock(): () => void {
  overlayLockCount += 1;
  if (overlayLockCount === 1) db.setFullScreenActive(true);
  emitOverlayChange();
  return () => {
    overlayLockCount = Math.max(0, overlayLockCount - 1);
    if (overlayLockCount === 0) db.setFullScreenActive(false);
    emitOverlayChange();
  };
}

/** Reset stuck locks after hot reload or interrupted overlays (dev safety). */
export function resetMediaOverlayLocks(): void {
  if (overlayLockCount === 0) return;
  overlayLockCount = 0;
  db.setFullScreenActive(false);
  emitOverlayChange();
}

export function isMediaOverlayLocked(): boolean {
  return overlayLockCount > 0;
}

function subscribeOverlayLocks(listener: () => void) {
  overlayListeners.add(listener);
  return () => overlayListeners.delete(listener);
}

/** True while any screen has an in-app media fullscreen layer open. */
export function useMediaOverlayLocked(): boolean {
  return useSyncExternalStore(
    subscribeOverlayLocks,
    isMediaOverlayLocked,
    () => false
  );
}

/** Hold overlay lock while `isOpen` (refcount-safe across surfaces). */
export function useMediaOverlayAcquire(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;
    return acquireMediaOverlayLock();
  }, [isOpen]);
}

/** Ignore backdrop / close handlers briefly after open (iOS ghost click). */
export function useFullscreenOpenGuard(isOpen: boolean) {
  const guardUntilRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    guardUntilRef.current = Date.now() + FULLSCREEN_OPEN_GUARD_MS;
  }, [isOpen]);

  const shouldIgnoreClose = () => Date.now() < guardUntilRef.current;

  const markOpened = () => {
    guardUntilRef.current = Date.now() + FULLSCREEN_OPEN_GUARD_MS;
  };

  return { shouldIgnoreClose, markOpened, guardUntilRef };
}

/** Safe backdrop click — only direct backdrop hits, respects open guard. */
export function createBackdropCloseHandler(
  onClose: () => void,
  shouldIgnoreClose: () => boolean
) {
  return (e: MouseEvent | PointerEvent) => {
    if (shouldIgnoreClose()) return;
    if (e.target !== e.currentTarget) return;
    e.stopPropagation();
    onClose();
  };
}
