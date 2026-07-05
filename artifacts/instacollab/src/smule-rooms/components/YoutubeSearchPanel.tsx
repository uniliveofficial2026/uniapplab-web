import React, { useCallback, useEffect, useState } from 'react';
import { Heart, Loader2, Play, Search, ThumbsUp, X, Youtube } from 'lucide-react';
import {
  isYoutubeFavorite,
  isYoutubeLiked,
  isYoutubeSearchConfigured,
  readYoutubeEngagement,
  searchYoutubeVideos,
  toggleYoutubeFavorite,
  toggleYoutubeLike,
  type YoutubeVideoSummary,
} from '../../services/youtube';

type YoutubeSearchPanelProps = {
  onSelectVideo: (video: YoutubeVideoSummary) => void;
  onClose?: () => void;
  compact?: boolean;
  selectLabel?: string;
};

export function YoutubeSearchPanel({
  onSelectVideo,
  onClose,
  compact = false,
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

  const refreshEngagement = useCallback(() => {
    setFavorites(readYoutubeEngagement('favorite'));
    setHistory(readYoutubeEngagement('history'));
  }, []);

  useEffect(() => {
    void isYoutubeSearchConfigured().then(setConfigured);
    refreshEngagement();
  }, [refreshEngagement]);

  const runSearch = async (searchQuery: string, pageToken?: string) => {
    const q = searchQuery.trim();
    if (!q) return;
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
      if (!pageToken) setResults([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void runSearch(query);
  };

  const handleFavoriteToggle = async (video: YoutubeVideoSummary) => {
    await toggleYoutubeFavorite(video);
    refreshEngagement();
  };

  const handleLikeToggle = async (video: YoutubeVideoSummary) => {
    await toggleYoutubeLike(video);
    refreshEngagement();
  };

  const renderResult = (video: YoutubeVideoSummary) => {
    const favorited = isYoutubeFavorite(video.videoId);
    const liked = isYoutubeLiked(video.videoId);

    return (
      <div
        key={video.videoId}
        className="flex gap-3 rounded-xl border border-white/10 bg-black/30 p-2"
      >
        <button
          type="button"
          onClick={() => onSelectVideo(video)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-black/50">
            {video.thumbnailUrl ? (
              <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
              <Play size={18} className="text-white" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-xs font-bold text-white">{video.title}</p>
            <p className="mt-1 truncate text-[10px] text-white/50">{video.channelTitle}</p>
          </div>
        </button>
        <div className="flex shrink-0 flex-col gap-1">
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

  return (
    <div className={`flex flex-col ${compact ? 'gap-3' : 'gap-4'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Youtube size={18} className="text-red-500" />
          <h3 className="text-sm font-black text-white">YouTube</h3>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Close YouTube search"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      {configured === false ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-200">
          YouTube search is not configured. Set <code className="font-mono">YOUTUBE_API_KEY</code> on the API server.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search YouTube videos"
            className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-red-500/50"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="shrink-0 rounded-xl bg-red-600 px-4 text-xs font-black text-white hover:bg-red-500 disabled:opacity-50"
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
          <div className={`space-y-2 ${compact ? 'max-h-56 overflow-y-auto pr-1 scrollbar-hide' : ''}`}>
            {results.map(renderResult)}
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

      {!loading && results.length === 0 && favorites.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Favorites</p>
          <div className={`space-y-2 ${compact ? 'max-h-40 overflow-y-auto pr-1 scrollbar-hide' : ''}`}>
            {favorites.map(renderResult)}
          </div>
        </div>
      ) : null}

      {!loading && results.length === 0 && history.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Recent</p>
          <div className={`space-y-2 ${compact ? 'max-h-40 overflow-y-auto pr-1 scrollbar-hide' : ''}`}>
            {history.slice(0, compact ? 5 : 10).map(renderResult)}
          </div>
        </div>
      ) : null}

      {!compact ? (
        <p className="text-center text-[10px] text-white/35">
          Tap a video, then choose “{selectLabel}”.
        </p>
      ) : null}
    </div>
  );
}
