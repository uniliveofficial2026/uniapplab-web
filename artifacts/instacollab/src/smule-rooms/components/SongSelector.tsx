import React, { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  filterCatalogSongs,
  getCatalogArtists,
  SONG_CATEGORIES,
  type CatalogArtist,
  type RoomCatalogSong,
  type SongCategory,
  type SongPickerSong,
} from '../utils/songCatalog';
import { isKaraokeUploadSongId } from '../utils/karaokeUploadBridge';
import {
  getFavoriteSongs,
  getMySongs,
  getPlaylistSongs,
  initSongLibrary,
} from '../utils/songLibrary';

export type SongSelectorTab = 'playlist' | 'favorites' | 'mySongs' | 'queue';

export type SongSelectorQueueItem = {
  id: string;
  title: string;
  artist: string;
  requestedBy: string;
  image?: string;
};

type BrowseMode = 'selection' | 'artists';

type SongSelectorProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectSong: (song: SongPickerSong) => void;
  songQueue: SongSelectorQueueItem[];
  /**
   * `widget` — bottom sheet over the live room (host still sees the stage).
   * `fullscreen` — classic full-screen picker.
   */
  variant?: 'widget' | 'fullscreen';
};

const TABS: { id: SongSelectorTab; label: string }[] = [
  { id: 'playlist', label: 'Playlist' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'mySongs', label: 'My Songs' },
  { id: 'queue', label: 'Queue' },
];

function tabSourceSongs(tab: SongSelectorTab): RoomCatalogSong[] {
  switch (tab) {
    case 'playlist':
      return getPlaylistSongs();
    case 'favorites':
      return getFavoriteSongs();
    case 'mySongs':
      return getMySongs();
    default:
      return [];
  }
}

export function SongSelector({
  isOpen,
  onClose,
  onSelectSong,
  songQueue,
  variant = 'widget',
}: SongSelectorProps) {
  const [activeTab, setActiveTab] = useState<SongSelectorTab>('queue');
  const [browseMode, setBrowseMode] = useState<BrowseMode>('selection');
  const [category, setCategory] = useState<SongCategory>('recommended');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [libraryVersion, setLibraryVersion] = useState(0);

  useEffect(() => {
    initSongLibrary();
  }, []);

  useEffect(() => {
    const refresh = () => setLibraryVersion((v) => v + 1);
    window.addEventListener('song-library-updated', refresh);
    window.addEventListener('karaoke-uploads-updated', refresh);
    return () => {
      window.removeEventListener('song-library-updated', refresh);
      window.removeEventListener('karaoke-uploads-updated', refresh);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    setSelectedArtist(null);
    setBrowseMode('selection');
    setCategory('recommended');
  }, [isOpen, activeTab]);

  const baseSongs = useMemo(() => {
    void libraryVersion;
    if (activeTab === 'queue') return [];
    return tabSourceSongs(activeTab);
  }, [activeTab, libraryVersion]);

  const filteredSongs = useMemo(() => {
    if (activeTab === 'queue') return [];
    return filterCatalogSongs(baseSongs, {
      query: searchQuery,
      category,
      artist: selectedArtist,
    });
  }, [activeTab, baseSongs, searchQuery, category, selectedArtist]);

  const artists = useMemo(
    () => getCatalogArtists(filterCatalogSongs(baseSongs, { query: searchQuery, category })),
    [baseSongs, searchQuery, category],
  );

  const filteredQueue = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return songQueue;
    return songQueue.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.artist.toLowerCase().includes(query) ||
        item.requestedBy.toLowerCase().includes(query),
    );
  }, [songQueue, searchQuery]);

  if (!isOpen) return null;

  const showBrowseFilters = activeTab !== 'queue';

  const handleSelectArtist = (artist: CatalogArtist) => {
    setSelectedArtist(artist.name);
    setBrowseMode('selection');
  };

  const handleQueueSong = (song: RoomCatalogSong) => {
    onSelectSong({
      id: song.id,
      title: song.title,
      artist: song.artist,
      image: song.image,
    });
  };

  const isWidget = variant === 'widget';

  const panel = (
    <div
      className={
        isWidget
          ? 'pointer-events-auto flex max-h-[min(72vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 border-b-0 bg-[#0f0b12]/92 shadow-[0_-16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:max-h-[min(70vh,42rem)] sm:rounded-3xl sm:border-b'
          : 'flex min-h-0 h-full w-full flex-1 flex-col overflow-hidden bg-[#0f0b12] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
      }
      role="dialog"
      aria-modal="true"
      aria-label="Song selector"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isWidget ? (
          <div className="mx-auto mt-2 mb-1 h-1 w-10 shrink-0 rounded-full bg-white/20" aria-hidden />
        ) : null}
        <div className="flex shrink-0 items-center gap-2 p-4 pt-2 sm:pt-4">
          <button type="button" onClick={onClose} aria-label="Close song selector">
            <X size={20} className="text-gray-400" />
          </button>
          <div className="ml-2 flex min-w-0 flex-1 space-x-4 overflow-x-auto text-sm font-bold uppercase tracking-wide">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 transition ${
                  activeTab === tab.id
                    ? 'border-b-2 border-pink-500 pb-1 text-pink-500'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab.label}
                {tab.id === 'queue' && songQueue.length > 0 ? ` (${songQueue.length})` : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3 shrink-0 px-4">
          <label className="flex items-center rounded-full bg-black/40 px-4 py-2 text-gray-500">
            <Search size={16} className="shrink-0" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by Artists or Songs"
              className="ml-2 min-w-0 flex-1 border-none bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-500"
            />
          </label>
        </div>

        {showBrowseFilters && (
          <>
            <div className="mb-3 flex shrink-0 space-x-2 px-4">
              <button
                type="button"
                onClick={() => {
                  setBrowseMode('artists');
                  setSelectedArtist(null);
                }}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  browseMode === 'artists'
                    ? 'bg-pink-100 text-pink-500'
                    : 'bg-white/5 text-gray-400 hover:text-gray-200'
                }`}
              >
                Artists
              </button>
              <button
                type="button"
                onClick={() => setBrowseMode('selection')}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  browseMode === 'selection'
                    ? 'bg-orange-100 text-orange-500'
                    : 'bg-white/5 text-gray-400 hover:text-gray-200'
                }`}
              >
                Selection
              </button>
              {selectedArtist && (
                <button
                  type="button"
                  onClick={() => setSelectedArtist(null)}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-teal-400"
                >
                  {selectedArtist} ×
                </button>
              )}
            </div>

            <div className="mb-3 flex shrink-0 space-x-3 overflow-x-auto px-4 text-xs font-bold text-gray-400">
              {SONG_CATEGORIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.id)}
                  className={`shrink-0 transition ${
                    category === item.id
                      ? 'text-pink-500 underline underline-offset-8'
                      : 'hover:text-gray-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div
          className={`min-h-0 flex-1 overflow-y-auto px-4 ${
            isWidget ? 'pb-[max(1rem,env(safe-area-inset-bottom))]' : 'pb-4'
          }`}
        >
          {activeTab === 'queue' ? (
            filteredQueue.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-500">
                {songQueue.length === 0
                  ? 'No songs in the room queue yet.'
                  : 'No queue matches your search.'}
              </p>
            ) : (
              filteredQueue.map((item, index) => (
                <div key={item.id} className="mb-4 flex items-center space-x-3">
                  <div className="w-8 shrink-0 text-center text-xs font-black text-pink-400">
                    #{index + 1}
                  </div>
                  <img
                    src={
                      item.image ??
                      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=80'
                    }
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate font-bold text-white">{item.title}</h4>
                    <p className="truncate text-xs text-gray-400">
                      {item.artist} · requested by {item.requestedBy}
                    </p>
                  </div>
                </div>
              ))
            )
          ) : browseMode === 'artists' ? (
            artists.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-500">No artists found.</p>
            ) : (
              artists.map((artist) => (
                <button
                  key={artist.name}
                  type="button"
                  onClick={() => handleSelectArtist(artist)}
                  className="-mx-2 mb-4 flex w-full items-center space-x-3 rounded-xl p-2 text-left transition hover:bg-white/5"
                >
                  <img
                    src={artist.image}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate font-bold text-white">{artist.name}</h4>
                    <p className="text-xs text-gray-400">
                      {artist.songCount} song{artist.songCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </button>
              ))
            )
          ) : filteredSongs.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">No songs match this filter.</p>
          ) : (
            filteredSongs.map((song) => (
              <div key={song.id} className="mb-4 flex items-center space-x-3">
                <img src={song.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <h4 className="truncate font-bold text-white">{song.title}</h4>
                  <p className="truncate text-xs text-gray-400">
                    {song.artist} •{' '}
                    {isKaraokeUploadSongId(song.id)
                      ? 'Your upload'
                      : `${song.recordings} recordings`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleQueueSong(song)}
                  className="shrink-0 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold text-pink-500 transition hover:bg-pink-500/20"
                >
                  Queue
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  if (isWidget) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
        onClick={onClose}
        role="presentation"
      >
        {panel}
      </div>
    );
  }

  return <div className="fixed inset-0 z-[100] flex min-h-0 w-full flex-col">{panel}</div>;
}
