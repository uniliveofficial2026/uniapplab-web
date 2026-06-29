import {
  ROOM_SONG_CATALOG,
  type RoomCatalogSong,
} from './songCatalog';
import {
  getKaraokeUploadRoomSongs,
  getRoomSongById,
} from './karaokeUploadBridge';

export type SongLibraryCollection = 'playlist' | 'favorites' | 'mySongs';

const STORAGE_KEYS: Record<SongLibraryCollection, string> = {
  playlist: 'smuleSongPlaylist',
  favorites: 'smuleSongFavorites',
  mySongs: 'smuleMySongs',
};

const DEFAULT_SEEDS: Record<SongLibraryCollection, string[]> = {
  playlist: ['mm-1', 'pop-1', 'pop-5'],
  favorites: ['mm-2', 'mm-3', 'kpop-1'],
  mySongs: ['mm-4', 'pop-3'],
};

function readIds(collection: SongLibraryCollection): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[collection]);
    if (!raw) return [...DEFAULT_SEEDS[collection]];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_SEEDS[collection]];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [...DEFAULT_SEEDS[collection]];
  }
}

function writeIds(collection: SongLibraryCollection, ids: string[]): void {
  localStorage.setItem(STORAGE_KEYS[collection], JSON.stringify(ids));
  window.dispatchEvent(
    new CustomEvent('song-library-updated', { detail: { collection } }),
  );
}

function resolveSongs(ids: string[]): RoomCatalogSong[] {
  return ids
    .map((id) => getRoomSongById(id))
    .filter((song): song is RoomCatalogSong => song !== undefined);
}

export function getPlaylistSongs(): RoomCatalogSong[] {
  return resolveSongs(readIds('playlist'));
}

export function getFavoriteSongs(): RoomCatalogSong[] {
  return resolveSongs(readIds('favorites'));
}

export function getMySongs(): RoomCatalogSong[] {
  const uploads = getKaraokeUploadRoomSongs();
  const uploadIds = new Set(uploads.map((song) => song.id));
  const catalog = resolveSongs(readIds('mySongs')).filter((song) => !uploadIds.has(song.id));
  return [...uploads, ...catalog];
}

export function isSongInCollection(songId: string, collection: SongLibraryCollection): boolean {
  return readIds(collection).includes(songId);
}

export function toggleSongInCollection(
  songId: string,
  collection: SongLibraryCollection,
): boolean {
  if (!getRoomSongById(songId)) return false;
  const ids = readIds(collection);
  const exists = ids.includes(songId);
  const next = exists ? ids.filter((id) => id !== songId) : [...ids, songId];
  writeIds(collection, next);
  return !exists;
}

export function addSongToCollection(songId: string, collection: SongLibraryCollection): void {
  if (!getRoomSongById(songId)) return;
  const ids = readIds(collection);
  if (ids.includes(songId)) return;
  writeIds(collection, [...ids, songId]);
}

/** Ensure library storage exists without overwriting user data. */
export function initSongLibrary(): void {
  (Object.keys(STORAGE_KEYS) as SongLibraryCollection[]).forEach((collection) => {
    if (!localStorage.getItem(STORAGE_KEYS[collection])) {
      writeIds(collection, DEFAULT_SEEDS[collection]);
    }
  });
}

export function getAllCatalogSongs(): RoomCatalogSong[] {
  return ROOM_SONG_CATALOG;
}
