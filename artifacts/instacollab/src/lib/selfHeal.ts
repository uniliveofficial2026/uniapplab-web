/**
 * Runtime self-heal — fixes media/URLs/layout WITHOUT reloads or visible flashing.
 * Deploy/sync/handoff run silently in the background; users pick up builds on next visit.
 */
import { isChunkLoadError } from './lazyWithRetry';
import { hydrateAppMediaUrl, isAppMediaRef } from './appMediaStore';
import { safeAvatarUrl, safeMediaUrl } from './safe';
import { stageAppUpdate } from './invisibleReload';
import { checkForPwaUpdate } from './pwaAutoUpdate';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&fit=crop';

const mediaFailCounts = new WeakMap<EventTarget, number>();

function healBrokenMedia(el: HTMLImageElement | HTMLVideoElement | HTMLAudioElement): void {
  const src = el.currentSrc || el.src;
  if (!src) return;

  if (isAppMediaRef(src) || src.startsWith('app-media:')) {
    void hydrateAppMediaUrl(src).then((resolved) => {
      if (resolved && resolved !== src && !isAppMediaRef(resolved)) {
        el.src = resolved;
      }
    });
    return;
  }

  if (el instanceof HTMLImageElement && el.dataset.selfHealFallback === '1') return;

  if (el instanceof HTMLImageElement) {
    const fails = (mediaFailCounts.get(el) ?? 0) + 1;
    mediaFailCounts.set(el, fails);
    if (fails < 2) return;

    const fallback =
      el.classList.contains('avatar') || el.dataset.avatar === 'true'
        ? safeAvatarUrl('')
        : safeMediaUrl('', { fallback: FALLBACK_IMAGE });
    if (fallback && el.src !== fallback) {
      el.src = fallback;
      el.dataset.selfHealFallback = '1';
    }
  }
}

function installMediaErrorHealing(): void {
  if (typeof document === 'undefined') return;

  document.addEventListener(
    'error',
    (event) => {
      const target = event.target;
      if (
        target instanceof HTMLImageElement ||
        target instanceof HTMLVideoElement ||
        target instanceof HTMLAudioElement
      ) {
        healBrokenMedia(target);
      }
    },
    true,
  );
}

function installChunkErrorHealing(): void {
  if (typeof window === 'undefined') return;

  const onChunkIssue = () => {
    void checkForPwaUpdate();
    stageAppUpdate('chunk_stale');
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadError(event.reason)) return;
    event.preventDefault();
    onChunkIssue();
  });
}

function installLayoutHealing(): void {
  if (typeof document === 'undefined') return;

  let layoutTimer: ReturnType<typeof setTimeout> | null = null;
  const fixOverflow = () => {
    const root = document.documentElement;
    if (root.scrollWidth > window.innerWidth + 8) {
      root.style.overflowX = 'clip';
      document.body.style.overflowX = 'clip';
    }
  };

  fixOverflow();
  window.addEventListener('resize', fixOverflow, { passive: true });
  const observer = new MutationObserver(() => {
    if (layoutTimer) return;
    layoutTimer = setTimeout(() => {
      layoutTimer = null;
      fixOverflow();
    }, 2000);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function installRuntimeSelfHeal(): void {
  if (typeof window === 'undefined') return;
  installMediaErrorHealing();
  installChunkErrorHealing();
  installLayoutHealing();
}
