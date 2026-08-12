import React, { useCallback, useEffect, useState } from 'react';
import { Heart, ListMusic, ListPlus, Loader2, Play, Search, ThumbsUp, X, Youtube } from 'lucide-react';
import { AddToPlaylistSheet } from '../../components/youtube/AddToPlaylistSheet';
import {
  listYoutubePlaylists,
  subscribeYoutubePlaylists,
  type YoutubePlaylist,
} from '../../lib/youtubePlaylists';
import {
  fetchAllYoutubePlaylistItems,
  isYoutubeFavorite,
  isYoutubeLiked,
  isYoutubeSearchConfigured,
  isYoutubeShortsUrl,
  parseYoutubePlaylistId,
  parseYoutubeVideoId,
  readYoutubeEngagement,
  searchYoutubeVideos,
  toggleYoutubeFavorite,
  toggleYoutubeLike,
  type YoutubeVideoSummary,
} from '../../services/youtube';

type YoutubeSearchPanelProps = {
  onSelectVideo: (
    video: YoutubeVideoSummary,
    context?: { queue: YoutubeVideoSummary[]; queueIndex: number },
  ) => void;
  onClose?: () => void;
  compact?: boolean;
  embedded?: boolean;
  selectLabel?: string;
};

export function YoutubeSearchPanel({
  onSelectVideo,
  onClose,
  compact = false,
  embedded = false,
  selectLabel = 'Play in room',
}: YoutubeSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState<YoutubeVideoSummary[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [favorites, setFavorites] = useState<YoutubeVideoSummary[]>([]);
  const [history, setHistory] = useState<YoutubeVideoSummary[]>([]);
  const [playlists, setPlaylists] = useState<YoutubePlaylist[]>([]);
  const [addToPlaylistVideo, setAddToPlaylistVideo] = useState<YoutubeVideoSummary | null>(null);

  const refreshEngagement = useCallback(() => {
    setFavorites(readYoutubeEngagement('favorite'));
    setHistory(readYoutubeEngagement('history'));
    setPlaylists(listYoutubePlaylists());
  }, []);

  useEffect(() => {
    void isYoutubeSearchConfigured().then(setConfigured);
    refreshEngagement();
    return subscribeYoutubePlaylists(refreshEngagement);
  }, [refreshEngagement]);

  const runSearch = async (searchQuery: string, pageToken?: string) => {
    const q = searchQuery.trim();
    if (!q) return;

    const playlistId = parseYoutubePlaylistId(q);
    if (playlistId && !pageToken) {
      setLoading(true);
      setError(null);
      try {
        const items = await fetchAllYoutubePlaylistItems(playlistId);
        setResults(items);
        setNextPageToken(null);
        setSubmittedQuery(q);
        if (items[0]) {
          selectFromList(items[0], items);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Playlist load failed';
        setError(message);
      } finally {
        setLoading(false);
      }
      return;
    }

    const videoId = parseYoutubeVideoId(q);
    if (videoId && !pageToken && !q.includes(' ')) {
      const video: YoutubeVideoSummary = {
        videoId,
        title: isYoutubeShortsUrl(q) ? 'YouTube Short' : 'YouTube video',
        channelTitle: '',
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        isShort: isYoutubeShortsUrl(q),
      };
      setResults([video]);
      setSubmittedQuery(q);
      setNextPageToken(null);
      selectFromList(video, [video]);
      return;
    }

    if (pageToken) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await searchYoutubeVideos(q, pageToken);
      setResults((prev) => (pageToken ? [...prev, ...response.items] : response.items));
      setNextPageToken(response.nextPageToken);
      if (!pageToken) setSubmittedQuery(q);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed';
      setError(message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void runSearch(query);
  };

  const handleQueryPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').trim();
    if (!pasted) return;
    if (parseYoutubeVideoId(pasted) || parseYoutubePlaylistId(pasted)) {
      event.preventDefault();
      setQuery(pasted);
      void runSearch(pasted);
    }
  };

  const handleFavoriteToggle = async (video: YoutubeVideoSummary) => {
    await toggleYoutubeFavorite(video);
    refreshEngagement();
  };

  const handleLikeToggle = async (video: YoutubeVideoSummary) => {
    await toggleYoutubeLike(video);
    refreshEngagement();
  };

  const selectFromList = (video: YoutubeVideoSummary, list: YoutubeVideoSummary[]) => {
    const queueIndex = Math.max(0, list.findIndex((item) => item.videoId === video.videoId));
    onSelectVideo(video, {
      queue: list.length > 0 ? list : [video],
      queueIndex: queueIndex >= 0 ? queueIndex : 0,
    });
  };

  const renderResult = (video: YoutubeVideoSummary, list: YoutubeVideoSummary[]) => {
    const favorited = isYoutubeFavorite(video.videoId);
    const liked = isYoutubeLiked(video.videoId);

    return (
      <div
        key={video.videoId}
        className="flex gap-2 rounded-xl border border-white/10 bg-black/30 p-2 sm:gap-3"
      >
        <button
          type="button"
          onClick={() => selectFromList(video, list)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left sm:gap-3"
        >
          <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-black/50 sm:h-16 sm:w-28">
            {video.thumbnailUrl ? (
              <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
              <Play size={18} className="text-white" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 break-words text-xs font-bold text-white">{video.title}</p>
            <p className="mt-1 truncate text-[10px] text-white/50">{video.channelTitle}</p>
          </div>
        </button>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={() => setAddToPlaylistVideo(video)}
            className="rounded-lg p-1.5 text-white/40 hover:text-white/70"
            aria-label="Add to playlist"
          >
            <ListPlus size={14} />
          </button>
          <button
            type="button"
            onClick={() => void handleFavoriteToggle(video)}
            className={`rounded-lg p-1.5 ${favorited ? 'text-pink-400' : 'text-white/40 hover:text-white/70'}`}
            aria-label={favorited ? 'Remove favorite' : 'Add favorite'}
          >
            <Heart size={14} className={favorited ? 'fill-current' : undefined} />
          </button>
          <button
            type="button"
            onClick={() => void handleLikeToggle(video)}
            className={`rounded-lg p-1.5 ${liked ? 'text-cyan-300' : 'text-white/40 hover:text-white/70'}`}
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            <ThumbsUp size={14} className={liked ? 'fill-current' : undefined} />
          </button>
        </div>
      </div>
    );
  };

  const renderPlaylistRow = (playlist: YoutubePlaylist) => {
    const cover = playlist.items[0]?.thumbnailUrl;
    const playable = playlist.items.length > 0;

    return (
      <button
        key={playlist.id}
        type="button"
        disabled={!playable}
        onClick={() => {
          if (!playable) return;
          selectFromList(playlist.items[0], playlist.items);
        }}
        className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-2 text-left disabled:opacity-50"
      >
        <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-black/50 sm:h-16 sm:w-28">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-white/35">
              <ListMusic size={18} />
            </span>
          )}
          {playable ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
              <Play size={18} className="text-white" />
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-white">{playlist.title}</p>
          <p className="mt-1 text-[10px] text-white/50">
            {playable ? `${playlist.items.length} videos` : 'Empty playlist'}
          </p>
        </div>
      </button>
    );
  };

  const listScrollClass = compact
    ? 'max-h-40 overflow-y-auto overscroll-contain pr-1 scrollbar-hide'
    : '';

  return (
    <>
      <div className={`flex min-w-0 flex-col ${compact ? 'gap-3' : 'gap-4'} ${embedded ? 'px-4 py-3' : ''}`}>
        {!embedded ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Youtube size={18} className="shrink-0 text-red-500" />
              <h3 className="truncate text-sm font-black text-white">YouTube</h3>
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                aria-label="Close YouTube search"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        ) : null}

        {configured === false ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-200">
            YouTube search is not configured. Set <code className="font-mono">YOUTUBE_API_KEY</code> on the API
            server.
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="flex min-w-0 gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onPaste={handleQueryPaste}
              placeholder="Search or paste YouTube link"
              className="w-full min-w-0 rounded-xl border border-white/10 bg-black/40 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-red-500/50"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="shrink-0 rounded-xl bg-red-600 px-3 py-2.5 text-xs font-black text-white hover:bg-red-500 disabled:opacity-50 sm:px-4"
          >
            {loading ? '…' : 'Search'}
          </button>
        </form>

        {error ? (
          <p className="text-[11px] font-bold text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-white/60">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-xs font-bold">Searching…</span>
          </div>
        ) : null}

        {!loading && results.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
              Results for “{submittedQuery}”
            </p>
            <div className={`space-y-2 ${listScrollClass}`}>
              {results.map((video) => renderResult(video, results))}
            </div>
            {nextPageToken ? (
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void runSearch(submittedQuery, nextPageToken)}
                className="w-full rounded-xl border border-white/10 py-2 text-xs font-bold text-white/70 hover:bg-white/5 disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && results.length === 0 && playlists.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Your playlists</p>
            <div className={`space-y-2 ${listScrollClass}`}>
              {playlists.slice(0, compact ? 4 : 8).map((playlist) => renderPlaylistRow(playlist))}
            </div>
          </div>
        ) : null}

        {!loading && results.length === 0 && favorites.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Favorites</p>
            <div className={`space-y-2 ${listScrollClass}`}>
              {favorites.map((video) => renderResult(video, favorites))}
            </div>
          </div>
        ) : null}

        {!loading && results.length === 0 && history.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Recent</p>
            <div className={`space-y-2 ${listScrollClass}`}>
              {history.slice(0, compact ? 5 : 10).map((video) =>
                renderResult(video, history.slice(0, compact ? 5 : 10)),
              )}
            </div>
          </div>
        ) : null}

        {!compact && !embedded ? (
          <p className="pb-1 text-center text-[10px] text-white/35">
            Tap a video, then choose “{selectLabel}”.
          </p>
        ) : null}
      </div>

      {addToPlaylistVideo ? (
        <AddToPlaylistSheet
          video={addToPlaylistVideo}
          playlists={playlists}
          onClose={() => setAddToPlaylistVideo(null)}
          zIndexClass="z-[430]"
        />
      ) : null}
    </>
  );
}
