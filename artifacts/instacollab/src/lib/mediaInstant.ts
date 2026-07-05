/**
 * Instant, clear media on slow networks:
 * 1) Prefer full-resolution blobs already on device (app-media / remote IDB cache)
 * 2) Paint fallback/poster immediately — never wait on bandwidth
 * 3) Background-fetch full-res once, store forever for next open/refresh
 */
import {
  cacheRemoteMediaUrl,
  hydrateAppMediaUrl,
  hydrateRemoteMediaMap,
  isAppMediaRef,
  resolveAppMediaUrlSync,
  resolveRemoteMediaUrlSync,
} from './appMediaStore';
import { isNetworkOnline } from './networkStatus';
import { fetchWithTimeout, NET_FEED_MS } from './networkPolicy';

const DEFAULT_FALLBACK =
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&fit=crop&q=85&auto=format';

const warming = new Set<string>();

/**
 * Prefer clear resolution for CDN thumbs (upgrade tiny w= params).
 * Keeps images sharp when shown from network or when caching.
 */
export function preferClearMediaUrl(url: string, highRes = false): string {
  if (!url.startsWith('http')) return url;
  const targetWidth = highRes ? 1080 : 640;
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (host.includes('unsplash.com') || host.includes('images.unsplash')) {
      const w = Number(u.searchParams.get('w') || 0);
      if (!w || w < targetWidth) u.searchParams.set('w', String(targetWidth));
      if (!u.searchParams.get('q')) u.searchParams.set('q', '85');
      u.searchParams.set('fit', 'crop');
      u.searchParams.set('auto', 'format');
      return u.toString();
    }
    if (host.includes('dicebear.com')) return url;
    // Generic: bump common width query params used by CDNs.
    for (const key of ['w', 'width', 'w_', 'sz']) {
      const v = Number(u.searchParams.get(key) || 0);
      if (v > 0 && v < targetWidth) {
        u.searchParams.set(key, String(targetWidth));
      }
    }
    return u.toString();
  } catch {
    return url;
  }
}

/** Sync URL for DOM — cached full-res blob when available, else network URL / fallback. */
export function instantMediaSrc(
  url: string | null | undefined,
  fallback: string = DEFAULT_FALLBACK,
): string {
  if (!url) return fallback;
  if (isAppMediaRef(url)) {
    const sync = resolveAppMediaUrlSync(url);
    if (sync && !isAppMediaRef(sync)) return sync;
    return fallback;
  }
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.startsWith('http')) {
    const clear = preferClearMediaUrl(url);
    const cached = resolveRemoteMediaUrlSync(clear) || resolveRemoteMediaUrlSync(url);
    if (cached) return cached;
    return clear;
  }
  return fallback;
}

/** Background: hydrate local blobs + download full-res remote media into IDB. */
export function warmMediaUrl(url: string | null | undefined): void {
  if (!url) return;
  if (isAppMediaRef(url)) {
    void hydrateAppMediaUrl(url).catch(() => undefined);
    return;
  }
  if (!url.startsWith('http')) return;

  const clear = preferClearMediaUrl(url);
  if (resolveRemoteMediaUrlSync(clear) || resolveRemoteMediaUrlSync(url)) return;
  if (warming.has(clear)) return;
  warming.add(clear);

  // Offline: cannot fetch; leave fallback/network URL to browser cache.
  if (!isNetworkOnline()) {
    warming.delete(clear);
    return;
  }

  void (async () => {
    try {
      const res = await fetchWithTimeout(
        clear,
        { mode: 'cors', credentials: 'omit', cache: 'force-cache' },
        NET_FEED_MS,
        'media-warm',
      );
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      if (blob.size < 32) return;
      await cacheRemoteMediaUrl(clear, blob);
      if (clear !== url) await cacheRemoteMediaUrl(url, blob).catch(() => undefined);
    } catch {
      /* keep painting network URL / fallback */
    } finally {
      warming.delete(clear);
    }
  })();
}

/** Boot: restore full-res media from IDB + warm refs in localStorage mirrors. */
export function warmMediaFromLocalStorageMirrors(): void {
  void hydrateRemoteMediaMap().catch(() => undefined);

  if (typeof localStorage === 'undefined') return;
  const refs = new Set<string>();
  const httpUrls = new Set<string>();
  const keys = ['posts', 'reels', 'messages', 'stories', 'users', 'chat_groups'];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      collectMediaUrls(JSON.parse(raw), refs, httpUrls);
    } catch {
      /* ignore */
    }
  }

  let appN = 0;
  for (const ref of refs) {
    if (appN++ > 16) break;
    void hydrateAppMediaUrl(ref).catch(() => undefined);
  }

  let httpN = 0;
  for (const http of httpUrls) {
    if (httpN++ > 10) break;
    warmMediaUrl(http);
  }
}

function collectMediaUrls(
  value: unknown,
  appRefs: Set<string>,
  httpUrls: Set<string>,
): void {
  if (typeof value === 'string') {
    if (isAppMediaRef(value)) appRefs.add(value);
    else if (value.startsWith('http')) httpUrls.add(value);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectMediaUrls(item, appRefs, httpUrls));
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    // Prefer image/poster fields for clear stills on slow links.
    if (
      typeof v === 'string' &&
      (k === 'imageUrl' ||
        k === 'avatarUrl' ||
        k === 'coverUrl' ||
        k === 'posterUrl' ||
        k === 'img' ||
        k === 'url' ||
        k === 'videoUrl')
    ) {
      collectMediaUrls(v, appRefs, httpUrls);
    } else {
      collectMediaUrls(v, appRefs, httpUrls);
    }
  }
}

/** Skip LiveKit preview on offline / very slow links — keep sharp poster. */
export function shouldSkipLiveVideoPreview(): boolean {
  if (!isNetworkOnline()) return true;
  const conn = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (conn?.saveData) return true;
  const type = conn?.effectiveType;
  return type === 'slow-2g' || type === '2g';
}
