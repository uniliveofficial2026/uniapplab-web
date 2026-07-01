import { db } from './db/localDb';
import {
  downloadKaraokeFileFromCloud,
  getKaraokeCloudUserId,
  getKaraokeFilePublicUrl,
  getKaraokeUploadOwnerUserId,
  uploadKaraokeFileToCloud,
} from './karaokeUploadCloud';
import { revokeUploadedSongAudioUrl } from './karaokeUploadSession';

export type KaraokeTimedWord = { text: string; time: number };

export type KaraokeTimedLyric = { text: string; time: number; words?: KaraokeTimedWord[] };

export type KaraokeUploadedSongMeta = {
  id: string;
  title: string;
  artist: string;
  plays: string;
  category?: string;
  type?: 'solo' | 'duet' | 'group';
  img?: string;
  tags?: string;
  lyrics?: string;
  timedLyrics?: KaraokeTimedLyric[];
  uploadedAt: number;
  hasAudio: boolean;
  mediaKind?: 'audio' | 'video';
  mimeType?: string;
  durationSec?: number;
  ownerUserId?: string;
  audioPath?: string;
  coverPath?: string;
  cloudSynced?: boolean;
};

export type KaraokeUploadInput = {
  id: string;
  title: string;
  artist: string;
  type: 'solo' | 'duet' | 'group';
  tags: string;
  lyrics: string;
  timedLyrics: KaraokeTimedLyric[];
  img: string;
  audioFile: File | null;
  coverFile?: File | null;
  mediaKind?: 'audio' | 'video';
};

const META_KEY = 'karaokeUploadedSongs';
const DB_KEY = 'karaoke_uploads';
const DB_NAME = 'KaraokeUploadMedia';
const DB_VERSION = 1;
const AUDIO_STORE = 'audio';

function readLegacyLocalStorage(): KaraokeUploadedSongMeta[] {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is KaraokeUploadedSongMeta =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as KaraokeUploadedSongMeta).id === 'string' &&
        typeof (item as KaraokeUploadedSongMeta).title === 'string',
    );
  } catch {
    return [];
  }
}

function migrateLegacyLocalStorageToDb(): void {
  const existing = db.load<KaraokeUploadedSongMeta[]>(DB_KEY, []);
  if (existing.length > 0) return;
  const legacy = readLegacyLocalStorage();
  if (legacy.length === 0) return;
  db.save(DB_KEY, legacy);
}

/** In-memory owner backfill — safe during React render (never writes). */
function applyMissingUploadOwnersInMemory(
  songs: KaraokeUploadedSongMeta[],
): KaraokeUploadedSongMeta[] {
  const ownerId = getKaraokeUploadOwnerUserId();
  if (!ownerId) return songs;
  return songs.map((song) =>
    song.ownerUserId ? song : { ...song, ownerUserId: ownerId },
  );
}

function persistMissingUploadOwners(songs: KaraokeUploadedSongMeta[]): void {
  const ownerId = getKaraokeUploadOwnerUserId();
  if (!ownerId) return;
  let changed = false;
  const next = songs.map((song) => {
    if (song.ownerUserId) return song;
    changed = true;
    return { ...song, ownerUserId: ownerId };
  });
  if (!changed) return;
  db.save(DB_KEY, next);
  try {
    localStorage.setItem(META_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

function readMetaList(): KaraokeUploadedSongMeta[] {
  const fromDb = db.load<KaraokeUploadedSongMeta[]>(DB_KEY, []);
  return applyMissingUploadOwnersInMemory([...fromDb]).sort(
    (a, b) => b.uploadedAt - a.uploadedAt,
  );
}

/** One-time legacy migration + owner backfill — call from effects / session bootstrap only. */
export function ensureKaraokeUploadsHydrated(): void {
  migrateLegacyLocalStorageToDb();
  const fromDb = db.load<KaraokeUploadedSongMeta[]>(DB_KEY, []);
  persistMissingUploadOwners(fromDb);
}

function writeMetaList(
  songs: KaraokeUploadedSongMeta[],
  detail?: { ownerUserId?: string; upload?: KaraokeUploadedSongMeta; deletedUploadId?: string },
): void {
  db.save(DB_KEY, songs);
  try {
    localStorage.setItem(META_KEY, JSON.stringify(songs));
  } catch {
    /* quota */
  }
  window.dispatchEvent(new CustomEvent('karaoke-uploads-updated', { detail }));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Could not open karaoke upload storage'));
    request.onupgradeneeded = () => {
      const idb = request.result;
      if (!idb.objectStoreNames.contains(AUDIO_STORE)) {
        idb.createObjectStore(AUDIO_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function saveAudioBlob(id: string, file: File | Blob): Promise<void> {
  const idb = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(AUDIO_STORE, 'readwrite');
    const store = tx.objectStore(AUDIO_STORE);
    const fileName = file instanceof File ? file.name : 'track.bin';
    store.put({
      id,
      blob: file,
      mimeType: file.type,
      fileName,
      updatedAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save karaoke audio'));
  });
}

export async function loadKaraokeUploadAudio(id: string): Promise<Blob | null> {
  const media = await loadKaraokeUploadMedia(id);
  return media?.blob ?? null;
}

export async function loadKaraokeUploadMedia(
  id: string,
): Promise<{ blob: Blob; mimeType: string; fileName?: string } | null> {
  const idb = await openDb();
  const local = await new Promise<{ blob: Blob; mimeType: string; fileName?: string } | null>(
    (resolve, reject) => {
      const tx = idb.transaction(AUDIO_STORE, 'readonly');
      const store = tx.objectStore(AUDIO_STORE);
      const request = store.get(id);
      request.onsuccess = () => {
        const row = request.result as { blob?: Blob; mimeType?: string; fileName?: string } | undefined;
        if (!row?.blob) {
          resolve(null);
          return;
        }
        resolve({
          blob: row.blob,
          mimeType: row.mimeType || row.blob.type || 'audio/mpeg',
          fileName: row.fileName,
        });
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to load karaoke media'));
    },
  );
  if (local) return local;

  const meta = readMetaList().find((song) => song.id === id);
  if (!meta?.audioPath) return null;
  const remote = await downloadKaraokeFileFromCloud(meta.audioPath);
  if (!remote) return null;
  await saveAudioBlob(id, remote);
  return {
    blob: remote,
    mimeType: meta.mimeType || remote.type || 'audio/mpeg',
    fileName: undefined,
  };
}

async function persistCoverImage(img: string, coverFile?: File | null): Promise<string> {
  if (coverFile) {
    try {
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : img);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(coverFile);
      });
    } catch {
      return img;
    }
  }
  if (!img || img.startsWith('data:') || img.startsWith('http')) return img;
  try {
    const response = await fetch(img);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : img);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return img;
  }
}

async function syncUploadAssetsToCloud(
  meta: KaraokeUploadedSongMeta,
  audioFile: File | null,
  coverFile: File | null | undefined,
  coverDataUrl: string,
): Promise<KaraokeUploadedSongMeta> {
  const userId = getKaraokeCloudUserId();
  if (!userId) return meta;

  let next = { ...meta, ownerUserId: userId };
  let cloudSynced = false;

  if (audioFile) {
    const audioPath = await uploadKaraokeFileToCloud(
      userId,
      meta.id,
      'audio',
      audioFile,
      audioFile.name || 'track.mp3',
    );
    if (audioPath) {
      next = { ...next, audioPath, hasAudio: true };
      cloudSynced = true;
    }
  }

  if (coverFile) {
    const coverPath = await uploadKaraokeFileToCloud(
      userId,
      meta.id,
      'cover',
      coverFile,
      coverFile.name || 'cover.jpg',
    );
    if (coverPath) {
      const publicUrl = await getKaraokeFilePublicUrl(coverPath);
      next = {
        ...next,
        coverPath,
        img: publicUrl || next.img,
      };
      cloudSynced = true;
    }
  } else if (coverDataUrl.startsWith('data:') && coverDataUrl.length < 120_000) {
    try {
      const response = await fetch(coverDataUrl);
      const blob = await response.blob();
      const coverPath = await uploadKaraokeFileToCloud(
        userId,
        meta.id,
        'cover',
        blob,
        'cover.jpg',
      );
      if (coverPath) {
        const publicUrl = await getKaraokeFilePublicUrl(coverPath);
        next = {
          ...next,
          coverPath,
          img: publicUrl || next.img,
        };
        cloudSynced = true;
      }
    } catch {
      /* keep local data url */
    }
  }

  return { ...next, cloudSynced: cloudSynced || next.cloudSynced };
}

export function listKaraokeUploads(): KaraokeUploadedSongMeta[] {
  return readMetaList();
}

/** Backing tracks uploaded by a user — separate from cover recordings in `karaokeRecordings`. */
export function listKaraokeUploadsForUser(userId: string): KaraokeUploadedSongMeta[] {
  const id = userId.trim();
  if (!id) return [];
  return readMetaList().filter((song) => song.ownerUserId === id);
}

export async function hydrateKaraokeUploadsFromCloud(): Promise<void> {
  const songs = readMetaList();
  await Promise.all(
    songs.map(async (song) => {
      if (!song.audioPath || !song.hasAudio) return;
      const local = await openDb().then(
        (idb) =>
          new Promise<boolean>((resolve) => {
            const tx = idb.transaction(AUDIO_STORE, 'readonly');
            const request = tx.objectStore(AUDIO_STORE).get(song.id);
            request.onsuccess = () => resolve(Boolean(request.result));
            request.onerror = () => resolve(false);
          }),
      );
      if (local) return;
      await loadKaraokeUploadAudio(song.id);
    }),
  );
}

export function readMediaDurationSec(url: string, kind: 'audio' | 'video' = 'audio'): Promise<number> {
  return new Promise((resolve) => {
    const media = kind === 'video' ? document.createElement('video') : new Audio();
    media.preload = 'metadata';
    media.onloadedmetadata = () => resolve(Number.isFinite(media.duration) ? media.duration : 180);
    media.onerror = () => resolve(180);
    media.src = url;
  });
}

/** @deprecated use readMediaDurationSec */
export function readAudioDurationSec(url: string): Promise<number> {
  return readMediaDurationSec(url, 'audio');
}

export async function saveKaraokeUpload(input: KaraokeUploadInput): Promise<KaraokeUploadedSongMeta> {
  const img = await persistCoverImage(input.img, input.coverFile);
  const mediaKind =
    input.mediaKind ??
    (input.audioFile?.type.startsWith('video/') ? 'video' : 'audio');
  const mimeType =
    input.audioFile?.type || (mediaKind === 'video' ? 'video/mp4' : 'audio/mpeg');
  let meta: KaraokeUploadedSongMeta = {
    id: input.id,
    title: input.title,
    artist: input.artist,
    plays: '0',
    category: (input.tags.split(',')[0] || 'Pop').trim(),
    type: input.type,
    img,
    tags: input.tags,
    lyrics: input.lyrics,
    timedLyrics: input.timedLyrics,
    uploadedAt: Date.now(),
    hasAudio: Boolean(input.audioFile),
    mediaKind,
    mimeType,
    ownerUserId: getKaraokeUploadOwnerUserId(),
    cloudSynced: false,
  };

  if (input.audioFile) {
    await saveAudioBlob(meta.id, input.audioFile);
    try {
      const previewUrl = URL.createObjectURL(input.audioFile);
      meta.durationSec = await readMediaDurationSec(previewUrl, mediaKind);
      URL.revokeObjectURL(previewUrl);
    } catch {
      /* optional */
    }
  }

  meta = await syncUploadAssetsToCloud(meta, input.audioFile, input.coverFile, img);
  if (!meta.ownerUserId) {
    meta = { ...meta, ownerUserId: getKaraokeUploadOwnerUserId() };
  }

  const next = [meta, ...readMetaList().filter((song) => song.id !== meta.id)];
  writeMetaList(next, { ownerUserId: meta.ownerUserId, upload: meta });

  return meta;
}

export function deleteKaraokeUpload(id: string): void {
  const removed = readMetaList().find((song) => song.id === id);
  writeMetaList(readMetaList().filter((song) => song.id !== id), {
    ownerUserId: removed?.ownerUserId,
    deletedUploadId: id,
  });
  revokeUploadedSongAudioUrl(id);
  void openDb().then((idb) => {
    const tx = idb.transaction(AUDIO_STORE, 'readwrite');
    tx.objectStore(AUDIO_STORE).delete(id);
  });
}

export function metaToLibrarySong(meta: KaraokeUploadedSongMeta) {
  return {
    id: meta.id,
    title: meta.title,
    artist: meta.artist,
    plays: meta.plays,
    category: meta.category,
    type: meta.type ?? 'solo',
    img: meta.img,
    isUploaded: true as const,
    lyrics: meta.lyrics,
    timedLyrics: meta.timedLyrics,
    durationSec: meta.durationSec,
    mediaKind: meta.mediaKind,
    isVideo: meta.mediaKind === 'video',
    mimeType: meta.mimeType,
  };
}
