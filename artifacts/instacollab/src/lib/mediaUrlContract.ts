/**
 * ONE presentation-media URL contract for DOM img/video/CSS.
 *
 * Distinguishes absolute https, root-relative app assets, bare relative paths,
 * blob/data, and app-media refs. Does NOT prepend API_BASE / origin /assets/
 * to values that are already absolute or root-relative.
 *
 * Asset-ID resolution stays in unilives-assets/resolver.ts (getAssetUrl).
 * This module only normalizes already-resolved URL strings for paint.
 */

export type MediaUrlSourceClass =
  | 'ABSOLUTE_HTTPS_ASSET'
  | 'ABSOLUTE_HTTP_ASSET'
  | 'PUBLIC_ROOT_ASSET'
  | 'APP_RELATIVE_ASSET'
  | 'BLOB_URL'
  | 'DATA_URL'
  | 'APP_MEDIA_REF'
  | 'EMPTY'
  | 'UNKNOWN';

const APP_MEDIA_PREFIX = 'app-media:';

export function classifyMediaUrlSource(raw: string | null | undefined): MediaUrlSourceClass {
  const s = String(raw ?? '').trim();
  if (!s) return 'EMPTY';
  if (s.startsWith(APP_MEDIA_PREFIX)) return 'APP_MEDIA_REF';
  if (s.startsWith('blob:')) return 'BLOB_URL';
  if (s.startsWith('data:')) return 'DATA_URL';
  if (/^https:\/\//i.test(s)) return 'ABSOLUTE_HTTPS_ASSET';
  if (/^http:\/\//i.test(s)) return 'ABSOLUTE_HTTP_ASSET';
  if (s.startsWith('/')) return 'PUBLIC_ROOT_ASSET';
  // Bare path relative to current route (e.g. "assets/foo.png") — normalize to root.
  if (/^[A-Za-z0-9_.@+-]+(\/[A-Za-z0-9_.@+-]+)*\/?(\?.*)?(#.*)?$/.test(s)) {
    return 'APP_RELATIVE_ASSET';
  }
  return 'UNKNOWN';
}

/**
 * Normalize a presentation URL for DOM use.
 * - Root-relative `/…` kept as-is (works with Cap server.url and Vite public/)
 * - Bare `assets/…` / `live-tools-v14/…` → `/assets/…`
 * - Absolute http(s), blob, data returned as-is
 * - Does not invent hosts for storage keys; callers must resolve those first
 */
export function normalizePresentationMediaUrl(
  raw: string | null | undefined,
): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const kind = classifyMediaUrlSource(s);
  switch (kind) {
    case 'PUBLIC_ROOT_ASSET':
    case 'ABSOLUTE_HTTPS_ASSET':
    case 'ABSOLUTE_HTTP_ASSET':
    case 'BLOB_URL':
    case 'DATA_URL':
    case 'APP_MEDIA_REF':
      return s;
    case 'APP_RELATIVE_ASSET':
      return `/${s.replace(/^\/+/, '')}`;
    default:
      // Protocol-relative //cdn… → keep; other junk left for caller fallback
      if (s.startsWith('//')) return `https:${s}`;
      return s;
  }
}

/** True when the string can be used as img/video src without further hydration. */
export function isPaintableMediaUrl(raw: string | null | undefined): boolean {
  const kind = classifyMediaUrlSource(raw);
  return (
    kind === 'ABSOLUTE_HTTPS_ASSET' ||
    kind === 'ABSOLUTE_HTTP_ASSET' ||
    kind === 'PUBLIC_ROOT_ASSET' ||
    kind === 'APP_RELATIVE_ASSET' ||
    kind === 'BLOB_URL' ||
    kind === 'DATA_URL'
  );
}

/**
 * Resolve for immediate paint. Returns fallback only for empty / unknown /
 * unresolved app-media refs — never replaces a valid root-relative asset path
 * with Unsplash.
 */
export function resolvePresentationMediaUrl(
  raw: string | null | undefined,
  fallback = '',
): string {
  const s = String(raw ?? '').trim();
  if (!s) return fallback;
  const kind = classifyMediaUrlSource(s);
  if (kind === 'APP_MEDIA_REF' || kind === 'UNKNOWN' || kind === 'EMPTY') {
    return fallback;
  }
  return normalizePresentationMediaUrl(s) || fallback;
}
