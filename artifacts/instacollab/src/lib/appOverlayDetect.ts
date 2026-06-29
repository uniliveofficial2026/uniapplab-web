import { useSyncExternalStore } from 'react';
import { db } from './db/localDb';
import { isMediaOverlayLocked, subscribeOverlayLocks } from './mediaOverlayLock';

/** Roots that indicate a full-screen / modal layer is open (see also data-app-overlay-root). */
const OVERLAY_ROOT_IDS = [
  'create-modal',
  'marketplace-modal',
  'post-modal',
  'edit-profile-modal',
  'archive-modal',
  'verification-modal',
  'cloud-systems-modal',
  'story-modal',
  'story-create-modal',
  'story-create-modal-root',
  'story-empty-modal',
  'mobile-menu-modal',
  'media-full-screen-modal',
  'reel-full-screen-modal',
  'reels-comments-drawer',
  'workspace-fs-modal',
  'story-ring-thought-modal',
] as const;

const OVERLAY_ROOT_SELECTOR = [
  ...OVERLAY_ROOT_IDS.map((id) => `#${CSS.escape(id)}`),
  '[data-app-overlay-root]',
  '[aria-modal="true"].fixed.inset-0',
].join(',');

const THOUGHT_COMPOSER_PORTAL_ID = 'story-thought-composer-portal';

let domObserver: MutationObserver | null = null;
let domListenerCount = 0;
const domListeners = new Set<() => void>();

function emitDomOverlayChange() {
  domListeners.forEach((listener) => listener());
}

function ensureDomObserver() {
  if (typeof document === 'undefined' || domObserver) return;
  domObserver = new MutationObserver(() => emitDomOverlayChange());
  domObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] });
}

function subscribeDomOverlays(listener: () => void) {
  domListeners.add(listener);
  domListenerCount += 1;
  ensureDomObserver();
  return () => {
    domListeners.delete(listener);
    domListenerCount = Math.max(0, domListenerCount - 1);
    if (domListenerCount === 0 && domObserver) {
      domObserver.disconnect();
      domObserver = null;
    }
  };
}

function subscribeDbFlags(listener: () => void) {
  return db.subscribe(listener);
}

function subscribeAllOverlaySignals(listener: () => void) {
  const cleanups = [
    subscribeOverlayLocks(listener),
    subscribeDomOverlays(listener),
    subscribeDbFlags(listener),
  ];
  return () => cleanups.forEach((cleanup) => cleanup());
}

function isDomOverlayOpen(): boolean {
  if (typeof document === 'undefined') return false;
  const match = document.querySelector(OVERLAY_ROOT_SELECTOR);
  if (!match || !(match instanceof HTMLElement)) return false;
  if (match.id === THOUGHT_COMPOSER_PORTAL_ID) return false;
  if (match.closest(`#${THOUGHT_COMPOSER_PORTAL_ID}`)) return false;
  const style = window.getComputedStyle(match);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return true;
}

/** True when any in-app modal, drawer, or fullscreen screen is open. */
export function isAppOverlayOpen(): boolean {
  if (isMediaOverlayLocked()) return true;
  if (db.isCreatorEditingActive) return true;
  return isDomOverlayOpen();
}

export function useAppOverlayOpen(): boolean {
  return useSyncExternalStore(
    subscribeAllOverlaySignals,
    isAppOverlayOpen,
    () => false,
  );
}
