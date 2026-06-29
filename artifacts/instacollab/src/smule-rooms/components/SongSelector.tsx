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

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0f0b12] min-h-0 w-full h-full">
      <div className="flex flex-1 flex-col min-h-0 w-full h-full overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="p-4 flex items-center shrink-0 gap-2">
          <button type="button" onClick={onClose} aria-label="Close song selector">
            <X size={20} className="text-gray-400" />
          </button>
          <div className="flex space-x-4 ml-2 uppercase font-bold text-sm tracking-wide overflow-x-auto min-w-0 flex-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 transition ${
                  activeTab === tab.id
                    ? 'text-pink-500 border-b-2 border-pink-500 pb-1'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab.label}
                {tab.id === 'queue' && songQueue.length > 0 ? ` (${songQueue.length})` : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 mb-4 shrink-0">
          <label className="bg-black/40 rounded-full px-4 py-2 flex items-center text-gray-500">
            <Search size={16} className="shrink-0" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by Artists or Songs"
              className="ml-2 text-sm bg-transparent border-none outline-none flex-1 min-w-0 text-gray-200 placeholder:text-gray-500"
            />
          </label>
        </div>

        {showBrowseFilters && (
          <>
            <div className="px-4 flex space-x-2 mb-4 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setBrowseMode('artists');
                  setSelectedArtist(null);
                }}
                className={`px-4 py-1.5 rounded-full font-bold text-xs transition ${
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
                className={`px-4 py-1.5 rounded-full font-bold text-xs transition ${
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
                  className="px-3 py-1.5 rounded-full font-bold text-xs bg-white/10 text-teal-400"
                >
                  {selectedArtist} ×
                </button>
              )}
            </div>

            <div className="px-4 flex space-x-3 mb-4 text-xs font-bold text-gray-400 shrink-0 overflow-x-auto">
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

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
          {activeTab === 'queue' ? (
            filteredQueue.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-12">
                {songQueue.length === 0
                  ? 'No songs in the room queue yet.'
                  : 'No queue matches your search.'}
              </p>
            ) : (
              filteredQueue.map((item, index) => (
                <div key={item.id} className="flex items-center space-x-3 mb-4">
                  <div className="w-8 text-center text-xs font-black text-pink-400 shrink-0">
                    #{index + 1}
                  </div>
                  <img
                    src={
                      item.image ??
                      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=80'
                    }
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white truncate">{item.title}</h4>
                    <p className="text-xs text-gray-400 truncate">
                      {item.artist} · requested by {item.requestedBy}
                    </p>
                  </div>
                </div>
              ))
            )
          ) : browseMode === 'artists' ? (
            artists.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-12">No artists found.</p>
            ) : (
              artists.map((artist) => (
                <button
                  key={artist.name}
                  type="button"
                  onClick={() => handleSelectArtist(artist)}
                  className="flex items-center space-x-3 mb-4 w-full text-left hover:bg-white/5 rounded-xl p-2 -mx-2 transition"
                >
                  <img
                    src={artist.image}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white truncate">{artist.name}</h4>
                    <p className="text-xs text-gray-400">
                      {artist.songCount} song{artist.songCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </button>
              ))
            )
          ) : filteredSongs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">No songs match this filter.</p>
          ) : (
            filteredSongs.map((song) => (
              <div key={song.id} className="flex items-center space-x-3 mb-4">
                <img src={song.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-white truncate">{song.title}</h4>
                  <p className="text-xs text-gray-400 truncate">
                    {song.artist} • {isKaraokeUploadSongId(song.id) ? 'Your upload' : `${song.recordings} recordings`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleQueueSong(song)}
                  className="bg-white/10 text-pink-500 font-bold text-xs px-4 py-1.5 rounded-full shrink-0 hover:bg-pink-500/20 transition"
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
}
