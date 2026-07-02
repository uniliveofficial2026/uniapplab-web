/**
 * Runtime self-heal — stale deploys, broken media/URLs, layout overflow, chunk errors.
 */
import { isChunkLoadError, recoverStaleBuild } from './lazyWithRetry';
import { hydrateAppMediaUrl, isAppMediaRef } from './appMediaStore';
import { safeAvatarUrl, safeMediaUrl } from './safe';
import { trackUx } from './uxTelemetry';

const LIVE_VERSION_KEY = 'instacollab-live-version';
const POLL_MS = Number(import.meta.env.VITE_LIVE_VERSION_POLL_MS ?? '120000');
const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&fit=crop';

function productionOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'app.uniapplab.com' || host.endsWith('.uniapplab.com');
}

async function pollLiveVersion(): Promise<void> {
  if (!productionOrigin()) return;
  try {
    const res = await fetch(`/live-version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as { id?: string };
    const id = data.id?.trim();
    if (!id) return;

    const prev = localStorage.getItem(LIVE_VERSION_KEY);
    if (prev && prev !== id) {
      console.info('[self-heal] New production build detected — refreshing');
      await recoverStaleBuild();
      return;
    }
    localStorage.setItem(LIVE_VERSION_KEY, id);
  } catch {
    /* ignore network blips */
  }
}

function healBrokenMedia(el: HTMLImageElement | HTMLVideoElement | HTMLAudioElement): void {
  const src = el.currentSrc || el.src;
  if (!src) return;

  if (isAppMediaRef(src) || src.startsWith('app-media:')) {
    void hydrateAppMediaUrl(src).then((resolved) => {
      if (resolved && resolved !== src && !isAppMediaRef(resolved)) {
        el.src = resolved;
        trackUx('heal', 'media_hydrate', { src: src.slice(0, 80) });
      }
    });
    return;
  }

  if (el instanceof HTMLImageElement) {
    trackUx('media_fail', src.slice(0, 120));
    const fallback = el.classList.contains('avatar') || el.dataset.avatar === 'true'
      ? safeAvatarUrl('')
      : safeMediaUrl('', { fallback: FALLBACK_IMAGE });
    if (fallback && el.src !== fallback) {
      el.src = fallback;
      el.dataset.selfHealFallback = '1';
      trackUx('heal', 'media_fallback');
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

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      event.preventDefault();
      void recoverStaleBuild();
    }
  });
}

function installLayoutHealing(): void {
  if (typeof document === 'undefined') return;

  const fixOverflow = () => {
    const root = document.documentElement;
    const body = document.body;
    if (root.scrollWidth > window.innerWidth + 4) {
      root.style.overflowX = 'clip';
      body.style.overflowX = 'clip';
    }
    const main = document.querySelector('main');
    if (main instanceof HTMLElement && main.scrollWidth > main.clientWidth + 4) {
      main.style.maxWidth = '100%';
      main.style.overflowX = 'hidden';
    }
  };

  fixOverflow();
  window.addEventListener('resize', fixOverflow, { passive: true });
  const observer = new MutationObserver(() => fixOverflow());
  observer.observe(document.body, { childList: true, subtree: true });
}

function installBrokenLinkHealing(): void {
  if (typeof document === 'undefined') return;

  document.addEventListener(
    'click',
    (event) => {
      const anchor = (event.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href')?.trim() ?? '';
      if (!href || href === '#' || href === 'javascript:void(0)') {
        event.preventDefault();
      }
    },
    true,
  );
}

function installConsoleWarningCapture(): void {
  if (typeof window === 'undefined' || !import.meta.env.DEV) return;

  const origWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    try {
      const key = 'instacollab-dev-warnings';
      const prev = JSON.parse(localStorage.getItem(key) || '[]') as string[];
      const msg = args.map((a) => String(a)).join(' ').slice(0, 200);
      if (!prev.includes(msg)) {
        prev.push(msg);
        localStorage.setItem(key, JSON.stringify(prev.slice(-50)));
      }
    } catch {
      /* ignore */
    }
  };
}

export function installRuntimeSelfHeal(): void {
  if (typeof window === 'undefined') return;

  installMediaErrorHealing();
  installChunkErrorHealing();
  installLayoutHealing();
  installBrokenLinkHealing();
  installConsoleWarningCapture();

  if (productionOrigin()) {
    void pollLiveVersion();
    window.setInterval(() => void pollLiveVersion(), POLL_MS);
  }
}
