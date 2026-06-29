import { getKaraokeUploadRoomSongs } from './karaokeUploadBridge';

export type SongCategory = 'recommended' | 'free' | 'hot' | 'trending' | 'new';

export type RoomCatalogSong = {
  id: string;
  title: string;
  artist: string;
  image: string;
  recordings: string;
  categories: SongCategory[];
};

export const SONG_CATEGORIES: { id: SongCategory; label: string }[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'free', label: 'Free' },
  { id: 'hot', label: 'Hot' },
  { id: 'trending', label: 'Trending' },
  { id: 'new', label: 'New' },
];

export const ROOM_SONG_CATALOG: RoomCatalogSong[] = [
  {
    id: 'mm-1',
    title: 'အစကမကြံသိခဲ့ရင္',
    artist: 'ေအာင္ျမသန့္',
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80',
    recordings: '7.1k',
    categories: ['recommended', 'hot', 'trending'],
  },
  {
    id: 'mm-2',
    title: 'အခ်စ္ဆိုတာလ်ိုက္ခ်ိုက္ခ်တစ္ခုပါ',
    artist: 'Sai Htee Saing',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80',
    recordings: '2.0k',
    categories: ['recommended', 'free', 'new'],
  },
  {
    id: 'mm-3',
    title: 'ပံုလမ္းမွအလမ္းရွင္ Unico...',
    artist: 'ေအာင္သု',
    image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80',
    recordings: '3.7k',
    categories: ['recommended', 'trending'],
  },
  {
    id: 'mm-4',
    title: 'အညာပံုျပင္',
    artist: 'ေအာင္ျမသန့္',
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=80',
    recordings: '1.4k',
    categories: ['hot', 'free'],
  },
  {
    id: 'pop-1',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    image: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f9af?w=80',
    recordings: '4.2M',
    categories: ['recommended', 'hot', 'trending'],
  },
  {
    id: 'pop-2',
    title: 'Someone Like You',
    artist: 'Adele',
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=80',
    recordings: '3.1M',
    categories: ['recommended', 'trending'],
  },
  {
    id: 'pop-3',
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80',
    recordings: '1.9M',
    categories: ['free', 'hot'],
  },
  {
    id: 'pop-4',
    title: 'Flowers',
    artist: 'Miley Cyrus',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80',
    recordings: '1.5M',
    categories: ['new', 'trending'],
  },
  {
    id: 'pop-5',
    title: 'Perfect',
    artist: 'Ed Sheeran',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80',
    recordings: '1.3M',
    categories: ['recommended', 'free'],
  },
  {
    id: 'kpop-1',
    title: 'Dynamite',
    artist: 'BTS',
    image: 'https://images.unsplash.com/photo-1614613535308-eb5f3963d975?w=80',
    recordings: '2.3M',
    categories: ['hot', 'trending'],
  },
  {
    id: 'kpop-2',
    title: 'How You Like That',
    artist: 'BLACKPINK',
    image: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=80',
    recordings: '1.8M',
    categories: ['new', 'hot'],
  },
  {
    id: 'rock-1',
    title: "Livin' on a Prayer",
    artist: 'Bon Jovi',
    image: 'https://images.unsplash.com/photo-1459745453916-9a3f2c0ea082?w=80',
    recordings: '2.0M',
    categories: ['recommended', 'free'],
  },
  {
    id: 'rock-2',
    title: "Don't Stop Believin'",
    artist: 'Journey',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=80',
    recordings: '1.8M',
    categories: ['trending'],
  },
  {
    id: 'rnb-1',
    title: 'Save Your Tears',
    artist: 'The Weeknd',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=80',
    recordings: '1.3M',
    categories: ['new', 'recommended'],
  },
  {
    id: 'rnb-2',
    title: 'No One',
    artist: 'Alicia Keys',
    image: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=80',
    recordings: '1.7M',
    categories: ['free', 'hot'],
  },
];

const catalogById = new Map(ROOM_SONG_CATALOG.map((song) => [song.id, song]));

export function getCatalogSongById(id: string): RoomCatalogSong | undefined {
  return catalogById.get(id);
}

export function getSongsByCategory(category: SongCategory): RoomCatalogSong[] {
  return ROOM_SONG_CATALOG.filter((song) => song.categories.includes(category));
}

export type ChorusSongTab = 'recommended' | 'hot' | 'trending' | 'new' | 'similar';

export const CHORUS_SONG_TABS: { id: ChorusSongTab; label: string }[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'hot', label: 'Hot' },
  { id: 'trending', label: 'Trending' },
  { id: 'new', label: 'New' },
  { id: 'similar', label: 'Similar' },
];

/** Songs shown in the in-room chorus strip (legacy default). */
export function getChorusPickSongs(limit = 4): RoomCatalogSong[] {
  return getSongsByCategory('recommended').slice(0, limit);
}

export function getSimilarCatalogSongs(
  anchorId?: string | null,
  limit = 12,
): RoomCatalogSong[] {
  const anchor = anchorId ? getCatalogSongById(anchorId) : undefined;
  if (!anchor) {
    return getSongsByCategory('recommended').slice(0, limit);
  }

  const ranked = ROOM_SONG_CATALOG.filter((song) => song.id !== anchor.id)
    .map((song) => {
      const sharedCategories = song.categories.filter((category) =>
        anchor.categories.includes(category),
      ).length;
      const sameArtist = song.artist === anchor.artist ? 3 : 0;
      return { song, score: sameArtist + sharedCategories };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.song);

  if (ranked.length > 0) return ranked.slice(0, limit);
  return ROOM_SONG_CATALOG.filter((song) => song.id !== anchor.id).slice(0, limit);
}

export function getChorusPanelSongs(
  tab: ChorusSongTab,
  options: { query?: string; similarToId?: string | null; limit?: number } = {},
): RoomCatalogSong[] {
  const limit = options.limit ?? 12;
  const query = options.query?.trim() ?? '';
  const uploads = filterCatalogSongs(getKaraokeUploadRoomSongs(), { query });

  let catalog: RoomCatalogSong[];
  if (tab === 'similar') {
    catalog = filterCatalogSongs(
      getSimilarCatalogSongs(options.similarToId, limit * 2),
      { query },
    ).slice(0, limit);
  } else {
    catalog = filterCatalogSongs(getSongsByCategory(tab), { query }).slice(0, limit);
  }

  const uploadIds = new Set(uploads.map((song) => song.id));
  return [...uploads, ...catalog.filter((song) => !uploadIds.has(song.id))];
}


export type CatalogArtist = {
  name: string;
  image: string;
  songCount: number;
  songs: RoomCatalogSong[];
};

export function getCatalogArtists(songs: RoomCatalogSong[]): CatalogArtist[] {
  const byArtist = new Map<string, RoomCatalogSong[]>();
  for (const song of songs) {
    const list = byArtist.get(song.artist) ?? [];
    list.push(song);
    byArtist.set(song.artist, list);
  }
  return [...byArtist.entries()]
    .map(([name, artistSongs]) => ({
      name,
      image: artistSongs[0]?.image ?? '',
      songCount: artistSongs.length,
      songs: artistSongs,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function filterCatalogSongs(
  songs: RoomCatalogSong[],
  options: {
    query?: string;
    category?: SongCategory;
    artist?: string | null;
  },
): RoomCatalogSong[] {
  const query = options.query?.trim().toLowerCase() ?? '';
  return songs.filter((song) => {
    if (options.category && !song.categories.includes(options.category)) return false;
    if (options.artist && song.artist !== options.artist) return false;
    if (!query) return true;
    return (
      song.title.toLowerCase().includes(query) ||
      song.artist.toLowerCase().includes(query)
    );
  });
}

export type SongPickerSong = Pick<RoomCatalogSong, 'id' | 'title' | 'artist' | 'image'>;
