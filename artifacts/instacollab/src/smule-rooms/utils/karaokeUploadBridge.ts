import {
  listKaraokeUploads,
  type KaraokeUploadedSongMeta,
} from '../../lib/karaokeUploads';
import {
  getCatalogSongById,
  type RoomCatalogSong,
  type SongCategory,
} from './songCatalog';

const UPLOAD_CATEGORIES: SongCategory[] = ['recommended', 'new', 'free'];

const DEFAULT_UPLOAD_COVER =
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=80&auto=format&fit=crop&q=60';

export function uploadMetaToRoomCatalogSong(meta: KaraokeUploadedSongMeta): RoomCatalogSong {
  return {
    id: meta.id,
    title: meta.title,
    artist: meta.artist,
    image: meta.img || DEFAULT_UPLOAD_COVER,
    recordings: meta.plays || '0',
    categories: UPLOAD_CATEGORIES,
  };
}

export function getKaraokeUploadRoomSongs(): RoomCatalogSong[] {
  return listKaraokeUploads().map(uploadMetaToRoomCatalogSong);
}

export function getUploadMetaById(id: string): KaraokeUploadedSongMeta | undefined {
  return listKaraokeUploads().find((song) => song.id === id);
}

export function isKaraokeUploadSongId(id: string): boolean {
  return Boolean(getUploadMetaById(id));
}

export function getRoomSongById(id: string): RoomCatalogSong | undefined {
  return getCatalogSongById(id) ?? getKaraokeUploadRoomSongs().find((song) => song.id === id);
}

export function mergeUploadsWithCatalogSongs(songs: RoomCatalogSong[]): RoomCatalogSong[] {
  const uploads = getKaraokeUploadRoomSongs();
  const seen = new Set(songs.map((song) => song.id));
  const fresh = uploads.filter((song) => !seen.has(song.id));
  return [...fresh, ...songs];
}
