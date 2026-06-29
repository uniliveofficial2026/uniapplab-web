import { db } from './db/localDb';
import { fileToBase64 } from './utils';

export type KaraokeProfileBackgroundMediaKind = 'image' | 'video';

/** Normalized pan (-1..1) and zoom from cover-fit baseline (1 = cover, up to 3). */
export type KaraokeProfileBackgroundFocus = {
  panX: number;
  panY: number;
  scale: number;
};

export const DEFAULT_KARAOKE_PROFILE_BACKGROUND_FOCUS: KaraokeProfileBackgroundFocus = {
  panX: 0,
  panY: 0,
  scale: 1,
};

export type KaraokeProfileBackground = {
  /** Inline data URL (images) or temporary blob URL while editing videos. */
  url: string;
  /** IndexedDB blob id for persisted profile videos. */
  mediaId?: string;
  mediaKind: KaraokeProfileBackgroundMediaKind;
  mimeType?: string;
  updatedAt: number;
  focus?: KaraokeProfileBackgroundFocus;
};

export type KaraokeProfileBackgroundLayout = {
  width: number;
  height: number;
  transform: string;
};

const DB_KEY = 'karaoke_profile_backgrounds';
const IDB_NAME = 'KaraokeProfileBackgrounds';
const IDB_VERSION = 1;
const MEDIA_STORE = 'media';

const mediaUrlCache = new Map<string, string>();

export const KARAOKE_PROFILE_BACKGROUND_IMAGE_MAX_BYTES = 12 * 1024 * 1024;
export const KARAOKE_PROFILE_BACKGROUND_VIDEO_MAX_BYTES = 80 * 1024 * 1024;
/** @deprecated use image/video-specific limits */
export const KARAOKE_PROFILE_BACKGROUND_MAX_BYTES = KARAOKE_PROFILE_BACKGROUND_IMAGE_MAX_BYTES;
export const KARAOKE_PROFILE_BACKGROUND_ACCEPT =
  'image/*,image/svg+xml,video/*,.svg,.webp,.png,.jpg,.jpeg,.gif,.mp4,.webm,.mov,.m4v';

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv|ogg)(\?.*)?$/i;

type KaraokeProfileBackgroundStore = Record<string, KaraokeProfileBackground>;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function inferKaraokeProfileBackgroundMediaKind(
  file: File,
): KaraokeProfileBackgroundMediaKind {
  if (file.type.startsWith('video/')) return 'video';
  if (VIDEO_EXT.test(file.name)) return 'video';
  return 'image';
}

function inferVideoMime(filename: string, fileType?: string): string {
  if (fileType?.startsWith('video/')) return fileType;
  const lower = filename.toLowerCase();
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.m4v')) return 'video/x-m4v';
  if (lower.endsWith('.ogv') || lower.endsWith('.ogg')) return 'video/ogg';
  return 'video/mp4';
}

export function normalizeKaraokeProfileBackgroundFocus(
  focus?: KaraokeProfileBackgroundFocus | null,
): KaraokeProfileBackgroundFocus {
  if (!focus) return { ...DEFAULT_KARAOKE_PROFILE_BACKGROUND_FOCUS };
  return {
    panX: clamp(focus.panX, -1, 1),
    panY: clamp(focus.panY, -1, 1),
    scale: clamp(focus.scale, 1, 3),
  };
}

/** Layout media inside a cover frame using normalized pan + zoom. */
export function layoutKaraokeProfileBackgroundMedia(
  containerW: number,
  containerH: number,
  mediaW: number,
  mediaH: number,
  focus?: KaraokeProfileBackgroundFocus | null,
): KaraokeProfileBackgroundLayout | null {
  if (!containerW || !containerH || !mediaW || !mediaH) return null;
  const f = normalizeKaraokeProfileBackgroundFocus(focus);
  const coverScale = Math.max(containerW / mediaW, containerH / mediaH);
  const scale = coverScale * f.scale;
  const dw = mediaW * scale;
  const dh = mediaH * scale;
  const maxPanX = Math.max(0, (dw - containerW) / 2);
  const maxPanY = Math.max(0, (dh - containerH) / 2);
  const tx = f.panX * maxPanX;
  const ty = f.panY * maxPanY;
  return {
    width: mediaW,
    height: mediaH,
    transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${scale})`,
  };
}

export function panKaraokeProfileBackgroundByPixels(
  focus: KaraokeProfileBackgroundFocus,
  containerW: number,
  containerH: number,
  mediaW: number,
  mediaH: number,
  deltaX: number,
  deltaY: number,
): KaraokeProfileBackgroundFocus {
  const f = normalizeKaraokeProfileBackgroundFocus(focus);
  const coverScale = Math.max(containerW / mediaW, containerH / mediaH);
  const scale = coverScale * f.scale;
  const dw = mediaW * scale;
  const dh = mediaH * scale;
  const maxPanX = Math.max(0, (dw - containerW) / 2);
  const maxPanY = Math.max(0, (dh - containerH) / 2);
  return {
    ...f,
    panX: maxPanX > 0 ? clamp(f.panX - deltaX / maxPanX, -1, 1) : 0,
    panY: maxPanY > 0 ? clamp(f.panY - deltaY / maxPanY, -1, 1) : 0,
  };
}

function hasPersistedBackground(row?: KaraokeProfileBackground | null): row is KaraokeProfileBackground {
  if (!row) return false;
  return Boolean(row.url || row.mediaId);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onerror = () =>
      reject(request.error ?? new Error('Could not open profile background storage'));
    request.onupgradeneeded = () => {
      const idb = request.result;
      if (!idb.objectStoreNames.contains(MEDIA_STORE)) {
        idb.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function saveProfileBackgroundBlob(
  id: string,
  blob: Blob,
  mimeType: string,
): Promise<void> {
  const idb = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(MEDIA_STORE, 'readwrite');
    tx.objectStore(MEDIA_STORE).put({
      id,
      blob,
      mimeType,
      updatedAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save profile background video'));
  });
}

async function loadProfileBackgroundBlob(
  id: string,
): Promise<{ blob: Blob; mimeType: string } | null> {
  const idb = await openDb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(MEDIA_STORE, 'readonly');
    const request = tx.objectStore(MEDIA_STORE).get(id);
    request.onsuccess = () => {
      const row = request.result as { blob?: Blob; mimeType?: string } | undefined;
      if (!row?.blob) {
        resolve(null);
        return;
      }
      resolve({
        blob: row.blob,
        mimeType: row.mimeType || row.blob.type || 'video/mp4',
      });
    };
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to load profile background video'));
  });
}

async function deleteProfileBackgroundBlob(id: string): Promise<void> {
  const cached = mediaUrlCache.get(id);
  if (cached) {
    URL.revokeObjectURL(cached);
    mediaUrlCache.delete(id);
  }
  const idb = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(MEDIA_STORE, 'readwrite');
    tx.objectStore(MEDIA_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete profile background video'));
  });
}

function sanitizeForPersist(background: KaraokeProfileBackground): KaraokeProfileBackground {
  if (background.mediaKind === 'video' && background.mediaId && background.url.startsWith('blob:')) {
    return { ...background, url: '' };
  }
  return background;
}

function readStore(): KaraokeProfileBackgroundStore {
  const raw = db.load<KaraokeProfileBackgroundStore | null>(DB_KEY, null);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw;
}

function writeStore(store: KaraokeProfileBackgroundStore): void {
  db.save(DB_KEY, store);
  window.dispatchEvent(new CustomEvent('karaoke-profile-background-updated'));
}

export async function resolveKaraokeProfileBackgroundPlayableUrl(
  background: Pick<KaraokeProfileBackground, 'url' | 'mediaId' | 'mediaKind' | 'mimeType'>,
): Promise<string | null> {
  if (background.url) return background.url;
  if (!background.mediaId) return null;

  const cached = mediaUrlCache.get(background.mediaId);
  if (cached) return cached;

  const media = await loadProfileBackgroundBlob(background.mediaId);
  if (!media) return null;

  const objectUrl = URL.createObjectURL(media.blob);
  mediaUrlCache.set(background.mediaId, objectUrl);
  return objectUrl;
}

export function getKaraokeProfileBackground(userId: string): KaraokeProfileBackground | null {
  const id = userId.trim();
  if (!id) return null;
  const row = readStore()[id];
  if (!hasPersistedBackground(row)) return null;
  return row;
}

export function setKaraokeProfileBackground(
  userId: string,
  background: KaraokeProfileBackground | null,
): void {
  const id = userId.trim();
  if (!id) return;
  const store = { ...readStore() };
  const existing = store[id];

  if (!hasPersistedBackground(background)) {
    if (existing?.mediaId) void deleteProfileBackgroundBlob(existing.mediaId);
    delete store[id];
  } else {
    const next = sanitizeForPersist(background);
    if (existing?.mediaId && existing.mediaId !== next.mediaId) {
      void deleteProfileBackgroundBlob(existing.mediaId);
    }
    store[id] = next;
  }

  writeStore(store);
}

export async function discardUnsavedKaraokeProfileBackgroundDraft(
  draft: KaraokeProfileBackground,
): Promise<void> {
  if (draft.url.startsWith('blob:')) {
    URL.revokeObjectURL(draft.url);
  }
  if (draft.mediaId) {
    await deleteProfileBackgroundBlob(draft.mediaId);
  }
}

export async function readKaraokeProfileBackgroundFile(
  file: File,
): Promise<KaraokeProfileBackground> {
  const mediaKind = inferKaraokeProfileBackgroundMediaKind(file);
  const maxBytes =
    mediaKind === 'video'
      ? KARAOKE_PROFILE_BACKGROUND_VIDEO_MAX_BYTES
      : KARAOKE_PROFILE_BACKGROUND_IMAGE_MAX_BYTES;

  if (file.size > maxBytes) {
    throw new Error(
      `Background ${mediaKind} must be under ${Math.round(maxBytes / (1024 * 1024))} MB`,
    );
  }

  if (mediaKind === 'video') {
    const mediaId = `kprofile-bg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const mimeType = inferVideoMime(file.name, file.type);
    await saveProfileBackgroundBlob(mediaId, file, mimeType);
    return {
      url: URL.createObjectURL(file),
      mediaId,
      mediaKind: 'video',
      mimeType,
      updatedAt: Date.now(),
    };
  }

  const url = await fileToBase64(file);
  return {
    url,
    mediaKind: 'image',
    mimeType: file.type || undefined,
    updatedAt: Date.now(),
  };
}
