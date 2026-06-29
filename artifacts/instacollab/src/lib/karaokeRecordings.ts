import { db } from './db/localDb';

export type KaraokePerformanceType = 'solo' | 'duet' | 'group';

export type KaraokeCoverPerformer = {
  handle: string;
  name: string;
  avatar?: string;
};

export type KaraokeCoverRecordingMeta = {
  id: string;
  songId: string;
  songTitle: string;
  performers: KaraokeCoverPerformer[];
  performanceType: KaraokePerformanceType;
  mediaKind: 'audio' | 'video';
  mimeType?: string;
  durationSec?: number;
  img?: string;
  caption?: string;
  score?: number;
  plays: number;
  likes: number;
  gifts: number;
  recordedAt: number;
  hasMedia: boolean;
  performerUserId?: string;
};

export type SaveKaraokeCoverRecordingInput = {
  songId: string;
  songTitle: string;
  performers: KaraokeCoverPerformer[];
  performanceType: KaraokePerformanceType;
  mediaKind: 'audio' | 'video';
  mediaBlob?: Blob | null;
  mimeType?: string;
  durationSec?: number;
  img?: string;
  caption?: string;
  score?: number;
  performerUserId?: string;
};

const DB_KEY = 'karaoke_recordings';
const IDB_NAME = 'KaraokeCoverRecordings';
const IDB_VERSION = 1;
const MEDIA_STORE = 'media';

const mediaUrlCache = new Map<string, string>();

function readMetaList(): KaraokeCoverRecordingMeta[] {
  return db.load<KaraokeCoverRecordingMeta[]>(DB_KEY, []);
}

function writeMetaList(
  list: KaraokeCoverRecordingMeta[],
  detail?: { songId?: string; recording?: KaraokeCoverRecordingMeta },
): void {
  db.save(DB_KEY, list);
  window.dispatchEvent(new CustomEvent('karaoke-recordings-updated', { detail }));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Could not open cover recording storage'));
    request.onupgradeneeded = () => {
      const idb = request.result;
      if (!idb.objectStoreNames.contains(MEDIA_STORE)) {
        idb.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function saveMediaBlob(id: string, blob: Blob, mimeType: string): Promise<void> {
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
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save cover recording media'));
  });
}

export async function loadKaraokeCoverRecordingMedia(
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
        mimeType: row.mimeType || row.blob.type || 'audio/webm',
      });
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to load cover recording media'));
  });
}

export async function resolveKaraokeCoverRecordingUrl(id: string): Promise<string | null> {
  const cached = mediaUrlCache.get(id);
  if (cached) return cached;

  const media = await loadKaraokeCoverRecordingMedia(id);
  if (!media) return null;

  const url = URL.createObjectURL(media.blob);
  mediaUrlCache.set(id, url);
  return url;
}

export function revokeKaraokeCoverRecordingUrl(id: string): void {
  const url = mediaUrlCache.get(id);
  if (!url) return;
  URL.revokeObjectURL(url);
  mediaUrlCache.delete(id);
}

export function listKaraokeCoverRecordings(songId?: string): KaraokeCoverRecordingMeta[] {
  const list = readMetaList().filter((row) => (songId ? row.songId === songId : true));
  return list.sort((a, b) => b.recordedAt - a.recordedAt);
}

export type KaraokeUserCoverCard = {
  id: string;
  songId: string;
  recordingId: string;
  kind: 'cover';
  title: string;
  artist: string;
  caption?: string;
  score?: number;
  plays: string;
  likes: string | number;
  date: string;
  img?: string;
  hasMedia: boolean;
};

export function coverRecordingToUserCard(meta: KaraokeCoverRecordingMeta): KaraokeUserCoverCard {
  return {
    id: meta.id,
    songId: meta.songId,
    recordingId: meta.id,
    kind: 'cover',
    title: meta.songTitle,
    artist: meta.performers.map((performer) => performer.name).join(' & ') || 'You',
    caption: meta.caption,
    score: meta.score,
    plays: formatRecordingCount(meta.plays),
    likes: meta.likes,
    date: formatRecordingAge(meta.recordedAt),
    img: meta.img,
    hasMedia: meta.hasMedia,
  };
}

export function listUserCoverCards(userId: string): KaraokeUserCoverCard[] {
  return readMetaList()
    .filter((row) => row.performerUserId === userId)
    .sort((a, b) => b.recordedAt - a.recordedAt)
    .map(coverRecordingToUserCard);
}

export function listKaraokeCoverRecordingsForUser(userId: string): KaraokeCoverRecordingMeta[] {
  return readMetaList()
    .filter((row) => row.performerUserId === userId)
    .sort((a, b) => b.recordedAt - a.recordedAt);
}

export async function saveKaraokeCoverRecording(
  input: SaveKaraokeCoverRecordingInput,
): Promise<KaraokeCoverRecordingMeta> {
  const id = `cover_${input.songId}_${Date.now()}`;
  const mimeType =
    input.mimeType ||
    input.mediaBlob?.type ||
    (input.mediaKind === 'video' ? 'video/webm' : 'audio/webm');

  const meta: KaraokeCoverRecordingMeta = {
    id,
    songId: input.songId,
    songTitle: input.songTitle,
    performers: input.performers,
    performanceType: input.performanceType,
    mediaKind: input.mediaKind,
    mimeType,
    durationSec: input.durationSec,
    img: input.img,
    caption: input.caption?.trim() || undefined,
    score:
      typeof input.score === 'number' && Number.isFinite(input.score)
        ? Math.max(0, Math.min(100, Math.round(input.score)))
        : undefined,
    plays: 0,
    likes: 0,
    gifts: 0,
    recordedAt: Date.now(),
    hasMedia: Boolean(input.mediaBlob),
    performerUserId: input.performerUserId,
  };

  if (input.mediaBlob) {
    await saveMediaBlob(id, input.mediaBlob, mimeType);
  }

  writeMetaList([meta, ...readMetaList()], { songId: input.songId, recording: meta });

  return meta;
}

export function incrementKaraokeCoverRecordingPlays(id: string): void {
  const next = readMetaList().map((row) =>
    row.id === id ? { ...row, plays: row.plays + 1 } : row,
  );
  writeMetaList(next);
}

export function deleteKaraokeCoverRecording(id: string): void {
  writeMetaList(readMetaList().filter((row) => row.id !== id));
  revokeKaraokeCoverRecordingUrl(id);
  void openDb().then((idb) => {
    const tx = idb.transaction(MEDIA_STORE, 'readwrite');
    tx.objectStore(MEDIA_STORE).delete(id);
  });
}

export function formatRecordingAge(recordedAt: number): string {
  const sec = Math.floor((Date.now() - recordedAt) / 1000);
  if (sec < 60) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

export function formatRecordingCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(value);
}

export function performanceTypeLabel(type: KaraokePerformanceType): string {
  if (type === 'duet') return 'Duet';
  if (type === 'group') return 'Group';
  return 'Solo';
}

export function isCoverRecordingVideo(
  recording: Pick<KaraokeCoverRecordingMeta, 'mediaKind' | 'mimeType'>,
): boolean {
  return recording.mediaKind === 'video' || Boolean(recording.mimeType?.startsWith('video/'));
}
