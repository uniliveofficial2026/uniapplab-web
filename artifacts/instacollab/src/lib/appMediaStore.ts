import type { MediaListItem } from './mediaCoverArt';
import { captureVideoPosterFrame, extractAudioCoverFromFile } from './mediaCoverArt';
import { db } from './db/localDb';

export const APP_MEDIA_PREFIX = 'app-media:';

const DB_NAME = 'AppUserMedia';
const DB_VERSION = 1;
const STORE = 'blobs';

const VIDEO_EXT = /\.(mp4|mov|webm|ogg|ogv|m4v|avi|wmv|mkv|3gp|mpeg|mpg)$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|oga|aac|m4a|flac|opus|weba|mid|midi)$/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif|avif|tiff?)$/i;

const blobUrlCache = new Map<string, string>();
const hydrateInflight = new Map<string, Promise<string>>();
const cacheListeners = new Set<() => void>();

function notifyCacheListeners(): void {
  cacheListeners.forEach((listener) => listener());
}

export function subscribeAppMediaCache(listener: () => void): () => void {
  cacheListeners.add(listener);
  return () => {
    cacheListeners.delete(listener);
  };
}

export function isResolvedAppMediaUrl(url: string): boolean {
  return !isAppMediaRef(url);
}

export function isAppMediaRef(url: string | undefined | null): boolean {
  return typeof url === 'string' && url.startsWith(APP_MEDIA_PREFIX);
}

export function appMediaIdFromRef(url: string): string {
  return url.slice(APP_MEDIA_PREFIX.length);
}

export function isUserOwnedMediaUrl(src: string | undefined | null): boolean {
  if (!src) return false;
  return (
    src.startsWith('data:') ||
    src.startsWith('blob:') ||
    src.startsWith(APP_MEDIA_PREFIX)
  );
}

export function detectMediaKind(file: File): 'image' | 'video' | 'audio' {
  const mime = (file.type || '').toLowerCase();
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';

  const name = file.name.toLowerCase();
  if (VIDEO_EXT.test(name)) return 'video';
  if (AUDIO_EXT.test(name)) return 'audio';
  if (IMAGE_EXT.test(name)) return 'image';

  return 'image';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Could not open app media storage'));
    request.onupgradeneeded = () => {
      const idb = request.result;
      if (!idb.objectStoreNames.contains(STORE)) {
        idb.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function saveBlob(id: string, file: File | Blob, fileName?: string): Promise<void> {
  const idb = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.put({
      id,
      blob: file,
      mimeType: file.type,
      fileName: fileName ?? (file instanceof File ? file.name : 'media.bin'),
      updatedAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save app media'));
  });
}

async function loadBlob(id: string): Promise<Blob | null> {
  const idb = await openDb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const request = store.get(id);
    request.onsuccess = () => {
      const row = request.result as { blob?: Blob } | undefined;
      resolve(row?.blob ?? null);
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to load app media'));
  });
}

export function registerAppMediaBlobUrl(id: string, blobUrl: string): void {
  const prev = blobUrlCache.get(id);
  if (prev && prev !== blobUrl) {
    try {
      URL.revokeObjectURL(prev);
    } catch {
      /* ignore */
    }
  }
  blobUrlCache.set(id, blobUrl);
  notifyCacheListeners();
}

export function resolveAppMediaUrlSync(url: string): string {
  if (!isAppMediaRef(url)) return url;
  const id = appMediaIdFromRef(url);
  return blobUrlCache.get(id) ?? url;
}

export async function hydrateAppMediaUrl(url: string): Promise<string> {
  if (!isAppMediaRef(url)) return url;
  const id = appMediaIdFromRef(url);
  const cached = blobUrlCache.get(id);
  if (cached) return cached;

  const inflight = hydrateInflight.get(id);
  if (inflight) return inflight;

  const promise = (async () => {
    const blob = await loadBlob(id);
    if (!blob) return url;
    const blobUrl = URL.createObjectURL(blob);
    registerAppMediaBlobUrl(id, blobUrl);
    return blobUrl;
  })();

  hydrateInflight.set(id, promise);
  try {
    const result = await promise;
    if (result !== url) notifyCacheListeners();
    return result;
  } finally {
    hydrateInflight.delete(id);
  }
}

function collectRefsFromValue(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    if (isAppMediaRef(value)) out.add(value);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectRefsFromValue(item, out));
    return;
  }
  Object.values(value as Record<string, unknown>).forEach((item) => collectRefsFromValue(item, out));
}

/** Warm blob URL cache for persisted uploads after refresh. */
export async function warmAppMediaCache(): Promise<void> {
  const refs = new Set<string>();
  try {
    await db.whenStorageReady();
    const snapshot = (db as unknown as { cache?: Record<string, unknown> }).cache;
    if (snapshot) {
      collectRefsFromValue(snapshot, refs);
    }
  } catch {
    /* db not ready */
  }
  if (refs.size === 0) return;
  await Promise.all([...refs].map((ref) => hydrateAppMediaUrl(ref)));
  notifyCacheListeners();
}

let warmInflight: Promise<void> | null = null;

/** Call before first paint so feed/chat/story media work immediately after refresh. */
export async function initAppMediaStore(options?: { timeoutMs?: number }): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 4000;
  const run = async () => {
    await db.whenStorageReady();
    await warmAppMediaCache();
  };

  if (!warmInflight) {
    warmInflight = run().finally(() => {
      warmInflight = null;
    });
  }

  await Promise.race([
    warmInflight,
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, timeoutMs);
    }),
  ]);
}

let warmDebounceTimer: number | null = null;

export function scheduleWarmAppMediaCache(): void {
  if (typeof window === 'undefined') return;
  if (warmDebounceTimer !== null) {
    window.clearTimeout(warmDebounceTimer);
  }
  warmDebounceTimer = window.setTimeout(() => {
    warmDebounceTimer = null;
    void warmAppMediaCache();
  }, 120);
}

/**
 * Persist an uploaded file without base64 encoding lag.
 * Returns a stable app-media ref for DB storage and a blob URL for instant preview.
 */
export async function processUploadFile(file: File): Promise<MediaListItem & { previewUrl: string }> {
  const type = detectMediaKind(file);
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `media_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const previewUrl = URL.createObjectURL(file);
  registerAppMediaBlobUrl(id, previewUrl);

  try {
    await saveBlob(id, file, file.name);
  } catch (err) {
    try {
      URL.revokeObjectURL(previewUrl);
    } catch {
      /* ignore */
    }
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error('File is too large for on-device storage. Try a shorter video or free space.');
    }
    throw new Error('Could not save media on this device.');
  }

  let coverUrl: string | undefined;
  if (type === 'audio') {
    coverUrl = await extractAudioCoverFromFile(file);
  } else if (type === 'video') {
    coverUrl = await Promise.race([
      captureVideoPosterFrame(previewUrl),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 8000)),
    ]);
  }

  return {
    url: `${APP_MEDIA_PREFIX}${id}`,
    previewUrl,
    type,
    name: file.name,
    coverUrl,
  };
}

/** Story / single-asset uploads. */
export async function processUploadFileAsUrl(file: File): Promise<string> {
  const item = await processUploadFile(file);
  return item.url;
}
