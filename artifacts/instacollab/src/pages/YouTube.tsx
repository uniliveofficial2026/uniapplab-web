import React, { useCallback, useEffect, useMemo, useState } from 'react';
import YouTube, { type YouTubeEvent } from 'react-youtube';
import {
  ArrowLeft,
  Clock3,
  Heart,
  ListMusic,
  ListPlus,
  Loader2,
  Play,
  Plus,
  Search,
  SkipBack,
  SkipForward,
  ThumbsUp,
  Trash2,
  Youtube,
} from 'lucide-react';
import { AddToPlaylistSheet } from '../components/youtube/AddToPlaylistSheet';
import { YoutubeLiveFullscreenFeed } from '../components/youtube/YoutubeLiveFullscreenFeed';
import {
  applyYoutubePlayerVolume,
  stabilizeYoutubePlayerVolume,
  YOUTUBE_PLAYER_VARS,
} from '../lib/youtubePlayerVolume';
import {
  clearYoutubeHistory,
  fetchAllYoutubePlaylistItems,
  fetchYoutubePopular,
  hydrateYoutubeEngagementFromCloud,
  isYoutubeFavorite,
  isYoutubeLiked,
  isYoutubeSearchConfigured,
  isYoutubeWatchLater,
  parseYoutubePlaylistId,
  parseYoutubeVideoId,
  readYoutubeEngagement,
  recordYoutubeHistory,
  searchYoutubeLive,
  searchYoutubeShorts,
  searchYoutubeVideos,
  isYoutubeShortsUrl,
  subscribeYoutubeEngagement,
  toggleYoutubeFavorite,
  toggleYoutubeLike,
  toggleYoutubeWatchLater,
  youtubeThumbnailUrl,
  type YoutubeVideoSummary,
} from '../services/youtube';
import {
  addVideoToYoutubePlaylist,
  createYoutubePlaylist,
  deleteYoutubePlaylist,
  getYoutubePlaylist,
  hydrateYoutubePlaylistsFromCloud,
  listYoutubePlaylists,
  removeVideoFromYoutubePlaylist,
  renameYoutubePlaylist,
  subscribeYoutubePlaylists,
  type YoutubePlaylist,
} from '../lib/youtubePlaylists';
import {
  closeYoutubeMiniPlayer,
} from '../lib/youtubeMiniPlayer';

type YouTubePageProps = {
  onBack?: () => void;
};

type LibraryTab =
  | 'search'
  | 'shorts'
  | 'live'
  | 'playlists'
  | 'watch_later'
  | 'liked'
  | 'favorites'
  | 'history';

const TABS: Array<{ id: LibraryTab; label: string }> = [
  { id: 'search', label: 'Feed' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'live', label: 'Live' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'watch_later', label: 'Watch later' },
  { id: 'liked', label: 'Liked' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'history', label: 'History' },
];

export function YouTubePage({ onBack }: YouTubePageProps) {
  const [tab, setTab] = useState<LibraryTab>('search');
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState<YoutubeVideoSummary[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<YoutubeVideoSummary | null>(null);
  const [activeQueue, setActiveQueue] = useState<YoutubeVideoSummary[]>([]);
  const [activeQueueIndex, setActiveQueueIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [engagementTick, setEngagementTick] = useState(0);
  const [playlistTick, setPlaylistTick] = useState(0);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [addToPlaylistVideo, setAddToPlaylistVideo] = useState<YoutubeVideoSummary | null>(null);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [importingPlaylist, setImportingPlaylist] = useState(false);
  const [shorts, setShorts] = useState<YoutubeVideoSummary[]>([]);
  const [shortsNextToken, setShortsNextToken] = useState<string | null>(null);
  const [shortsQuery, setShortsQuery] = useState('');
  const [shortsIndex, setShortsIndex] = useState(0);
  const [loadingShorts, setLoadingShorts] = useState(false);
  const [shortsMode, setShortsMode] = useState(false);
  const [lives, setLives] = useState<YoutubeVideoSummary[]>([]);
  const [livesNextToken, setLivesNextToken] = useState<string | null>(null);
  const [livesQuery, setLivesQuery] = useState('');
  const [livesEventType, setLivesEventType] = useState<'live' | 'upcoming'>('live');
  const [loadingLives, setLoadingLives] = useState(false);
  const [liveFullscreen, setLiveFullscreen] = useState(false);
  const [homeFeed, setHomeFeed] = useState<YoutubeVideoSummary[]>([]);
  const [homeFeedNext, setHomeFeedNext] = useState<string | null>(null);
  const [homeShorts, setHomeShorts] = useState<YoutubeVideoSummary[]>([]);
  const [homeLives, setHomeLives] = useState<YoutubeVideoSummary[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);

  const favorites = useMemo(() => readYoutubeEngagement('favorite'), [engagementTick]);
  const history = useMemo(() => readYoutubeEngagement('history'), [engagementTick]);
  const liked = useMemo(() => readYoutubeEngagement('like'), [engagementTick]);
  const watchLater = useMemo(() => readYoutubeEngagement('watch_later'), [engagementTick]);
  const playlists = useMemo(() => listYoutubePlaylists(), [playlistTick]);
  const activePlaylist = useMemo(
    () => (activePlaylistId ? getYoutubePlaylist(activePlaylistId) : null),
    [activePlaylistId, playlistTick],
  );

  useEffect(() => {
    void isYoutubeSearchConfigured().then(setConfigured);
    void hydrateYoutubeEngagementFromCloud().then(() => setEngagementTick((t) => t + 1));
    void hydrateYoutubePlaylistsFromCloud().then(() => setPlaylistTick((t) => t + 1));
    // Full YouTube screen owns playback — keep the floating mini player closed.
    closeYoutubeMiniPlayer();
  }, []);

  useEffect(() => subscribeYoutubeEngagement(() => setEngagementTick((t) => t + 1)), []);
  useEffect(() => subscribeYoutubePlaylists(() => setPlaylistTick((t) => t + 1)), []);

  const refreshEngagement = useCallback(() => {
    setEngagementTick((tick) => tick + 1);
  }, []);

  const loadHomeFeed = useCallback(
    async (pageToken?: string) => {
      if (pageToken) setLoadingMore(true);
      else setLoadingFeed(true);
      setError(null);
      try {
        const videosPromise = pageToken
          ? fetchYoutubePopular(pageToken)
          : fetchYoutubePopular();
        const shortsPromise = pageToken
          ? Promise.resolve(null)
          : searchYoutubeShorts().catch(() => null);
        const livesPromise = pageToken
          ? Promise.resolve(null)
          : searchYoutubeLive(undefined, undefined, 'live').catch(() => null);

        const [videos, shortsRes, livesRes] = await Promise.all([
          videosPromise,
          shortsPromise,
          livesPromise,
        ]);

        setHomeFeed((prev) => (pageToken ? [...prev, ...videos.items] : videos.items));
        setHomeFeedNext(videos.nextPageToken);
        if (!pageToken) {
          if (shortsRes?.items?.length) {
            setHomeShorts(shortsRes.items.map((item) => ({ ...item, isShort: true })).slice(0, 12));
          }
          if (livesRes?.items?.length) {
            setHomeLives(livesRes.items.map((item) => ({ ...item, isLive: true })).slice(0, 8));
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Feed failed');
      } finally {
        setLoadingFeed(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (configured === false) return;
    if (tab !== 'search') return;
    if (submittedQuery) return;
    if (homeFeed.length > 0) return;
    void loadHomeFeed();
  }, [configured, tab, submittedQuery, homeFeed.length, loadHomeFeed]);

  const loadShorts = useCallback(
    async (searchQuery?: string, pageToken?: string): Promise<YoutubeVideoSummary[]> => {
      if (pageToken) setLoadingMore(true);
      else setLoadingShorts(true);
      setError(null);
      try {
        const response = await searchYoutubeShorts(searchQuery, pageToken);
        const items = response.items.map((item) => ({ ...item, isShort: true }));
        setShorts((prev) => (pageToken ? [...prev, ...items] : items));
        setShortsNextToken(response.nextPageToken);
        if (!pageToken) {
          setShortsIndex(0);
          if (items[0]) {
            setActiveVideo(items[0]);
            setActiveQueue(items);
            setActiveQueueIndex(0);
            setShortsMode(true);
            await recordYoutubeHistory(items[0]);
            refreshEngagement();
          }
        }
        return items;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Shorts failed');
        return [];
      } finally {
        setLoadingShorts(false);
        setLoadingMore(false);
      }
    },
    [refreshEngagement],
  );

  useEffect(() => {
    if (tab !== 'shorts') return;
    if (shorts.length > 0) return;
    void loadShorts();
  }, [tab, shorts.length, loadShorts]);

  const loadLives = useCallback(
    async (
      searchQuery?: string,
      pageToken?: string,
      eventType: 'live' | 'upcoming' = livesEventType,
    ): Promise<YoutubeVideoSummary[]> => {
      if (pageToken) setLoadingMore(true);
      else setLoadingLives(true);
      setError(null);
      try {
        const response = await searchYoutubeLive(searchQuery, pageToken, eventType);
        const items = response.items.map((item) => ({
          ...item,
          isLive: item.isLive ?? eventType === 'live',
        }));
        setLives((prev) => (pageToken ? [...prev, ...items] : items));
        setLivesNextToken(response.nextPageToken);
        if (pageToken && items.length > 0) {
          setActiveQueue((prev) => {
            if (prev.length === 0) return items;
            const seen = new Set(prev.map((entry) => entry.videoId));
            const appended = items.filter((entry) => !seen.has(entry.videoId));
            return appended.length > 0 ? [...prev, ...appended] : prev;
          });
        }
        if (!pageToken && items[0]) {
          setShortsMode(false);
          setActiveVideo(items[0]);
          setActiveQueue(items);
          setActiveQueueIndex(0);
          setLiveFullscreen(eventType === 'live');
          await recordYoutubeHistory(items[0]);
          refreshEngagement();
        }
        return items;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Live failed');
        return [];
      } finally {
        setLoadingLives(false);
        setLoadingMore(false);
      }
    },
    [livesEventType, refreshEngagement],
  );

  useEffect(() => {
    if (tab !== 'live') return;
    if (lives.length > 0) return;
    void loadLives();
  }, [tab, lives.length, loadLives]);

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
        setTab('search');
        if (items[0]) {
          setActiveVideo(items[0]);
          setActiveQueue(items);
          setActiveQueueIndex(0);
          setShortsMode(false);
          await recordYoutubeHistory(items[0]);
          refreshEngagement();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Playlist load failed');
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
        thumbnailUrl: youtubeThumbnailUrl(videoId),
        isShort: isYoutubeShortsUrl(q),
      };
      setResults([video]);
      setSubmittedQuery(q);
      setNextPageToken(null);
      await playVideo(video);
      return;
    }

    if (pageToken) setLoadingMore(true);
    else {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await searchYoutubeVideos(q, pageToken);
      setResults((prev) => (pageToken ? [...prev, ...response.items] : response.items));
      setNextPageToken(response.nextPageToken);
      if (!pageToken) setSubmittedQuery(q);
      setTab('search');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const playVideo = async (
    video: YoutubeVideoSummary,
    queue?: YoutubeVideoSummary[],
    queueIndex = 0,
    playlistId?: string | null,
  ) => {
    const list = queue && queue.length > 0 ? queue : [video];
    const index = Math.max(0, Math.min(queueIndex, list.length - 1));
    const current = list[index] ?? video;
    const asShort = Boolean(current.isShort);
    const asLive = Boolean(current.isLive);
    setShortsMode(asShort);
    setLiveFullscreen(asLive);
    setActiveVideo(current);
    setActiveQueue(list);
    setActiveQueueIndex(index);
    if (asShort) {
      setShorts(list);
      setShortsIndex(index);
    }
    if (asLive) {
      setLives(list);
    }
    await recordYoutubeHistory(current);
    refreshEngagement();
  };

  const playQueueOffset = (delta: number) => {
    if (activeQueue.length === 0) return;
    const nextIndex = activeQueueIndex + delta;
    if (nextIndex < 0 || nextIndex >= activeQueue.length) return;
    const next = activeQueue[nextIndex];
    if (!next) return;
    setActiveVideo(next);
    setActiveQueueIndex(nextIndex);
    if (shortsMode) setShortsIndex(nextIndex);
    if (next.isLive) setLiveFullscreen(true);
    void recordYoutubeHistory(next).then(refreshEngagement);
  };

  const loadMoreLivesForFullscreen = useCallback(() => {
    if (!livesNextToken || loadingMore || loadingLives) return;
    void loadLives(livesQuery.trim() || undefined, livesNextToken, livesEventType);
  }, [livesEventType, livesNextToken, livesQuery, loadLives, loadingLives, loadingMore]);

  const playNextShort = () => {
    const next = shortsIndex + 1;
    if (next < shorts.length) {
      void playVideo(shorts[next], shorts, next);
      return;
    }
    if (!shortsNextToken) return;
    void (async () => {
      const appended = await loadShorts(shortsQuery.trim() || undefined, shortsNextToken);
      if (appended[0]) {
        const queue = [...shorts, ...appended];
        void playVideo(appended[0], queue, shorts.length);
      }
    })();
  };

  const handleFavorite = async (video: YoutubeVideoSummary) => {
    await toggleYoutubeFavorite(video);
    refreshEngagement();
  };

  const handleLike = async (video: YoutubeVideoSummary) => {
    await toggleYoutubeLike(video);
    refreshEngagement();
  };

  const handleWatchLater = async (video: YoutubeVideoSummary) => {
    await toggleYoutubeWatchLater(video);
    refreshEngagement();
  };

  const importPublicPlaylist = async () => {
    const playlistId = parseYoutubePlaylistId(playlistUrl);
    if (!playlistId) {
      setError('Paste a valid YouTube playlist URL or PL… id');
      return;
    }
    setImportingPlaylist(true);
    setError(null);
    try {
      const items = await fetchAllYoutubePlaylistItems(playlistId);
      if (items.length === 0) {
        setError('Playlist is empty or unavailable');
        return;
      }
      const created = await createYoutubePlaylist(`Imported · ${items[0]?.title?.slice(0, 40) || playlistId}`);
      for (const item of items) {
        await addVideoToYoutubePlaylist(created.id, item);
      }
      setPlaylistUrl('');
      setActivePlaylistId(created.id);
      setTab('playlists');
      setPlaylistTick((t) => t + 1);
      await playVideo(items[0], items, 0, playlistId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportingPlaylist(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  /** YouTube-home style grid card (16:9 thumb + title/channel under). */
  const renderFeedCard = (video: YoutubeVideoSummary, queue?: YoutubeVideoSummary[], index = 0) => {
    const duration = formatDuration(video.durationSeconds);
    const list = queue && queue.length > 0 ? queue : [video];
    return (
      <div key={`${video.videoId}-${index}`} className="group flex w-full flex-col text-left">
        <button
          type="button"
          onClick={() => void playVideo(video, list, index)}
          className="relative aspect-video w-full overflow-hidden rounded-xl bg-black/50"
        >
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          ) : null}
          <div className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/25" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
            <span className="rounded-full bg-black/70 p-3 text-white shadow-lg">
              <Play size={22} className="fill-white" />
            </span>
          </div>
          {video.isLive ? (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Live
            </span>
          ) : null}
          {duration ? (
            <span className="absolute bottom-2 right-2 rounded bg-black/85 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
              {duration}
            </span>
          ) : null}
          {typeof video.concurrentViewers === 'number' ? (
            <span className="absolute bottom-2 left-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {video.concurrentViewers.toLocaleString()} watching
            </span>
          ) : null}
        </button>
        <div className="mt-2.5 flex gap-3 px-0.5">
          <button
            type="button"
            onClick={() => void playVideo(video, list, index)}
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-rose-700 text-[11px] font-black uppercase text-white"
            aria-label={`Play ${video.title}`}
          >
            {(video.channelTitle || 'YT').slice(0, 1)}
          </button>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => void playVideo(video, list, index)}
              className="w-full text-left"
            >
              <p className="line-clamp-2 text-[13px] font-bold leading-snug text-foreground sm:text-sm">
                {video.title}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{video.channelTitle}</p>
            </button>
            <div className="mt-1.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void handleWatchLater(video)}
                className={`rounded-full p-1 ${isYoutubeWatchLater(video.videoId) ? 'text-amber-500' : 'text-muted-foreground hover:text-foreground'}`}
                aria-label="Watch later"
              >
                <Clock3 size={14} />
              </button>
              <button
                type="button"
                onClick={() => void handleLike(video)}
                className={`rounded-full p-1 ${isYoutubeLiked(video.videoId) ? 'text-cyan-500' : 'text-muted-foreground hover:text-foreground'}`}
                aria-label="Like"
              >
                <ThumbsUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => setAddToPlaylistVideo(video)}
                className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                aria-label="Add to playlist"
              >
                <ListPlus size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderResultCard = (video: YoutubeVideoSummary, options?: { onRemove?: () => void }) => {
    const favorited = isYoutubeFavorite(video.videoId);
    const likedVideo = isYoutubeLiked(video.videoId);
    const later = isYoutubeWatchLater(video.videoId);

    return (
      <div key={video.videoId} className="flex gap-3 rounded-2xl border border-border bg-card/60 p-3">
        <button
          type="button"
          onClick={() => void playVideo(video)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-black/40">
            {video.thumbnailUrl ? (
              <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {video.isLive ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded bg-red-600 px-1 py-0.5 text-[9px] font-black uppercase text-white">
                  Live
                </span>
              ) : null}
              {video.isShort ? (
                <span className="shrink-0 rounded bg-zinc-700 px-1 py-0.5 text-[9px] font-black uppercase text-white">
                  Short
                </span>
              ) : null}
              <p className="line-clamp-2 text-sm font-bold text-foreground">{video.title}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{video.channelTitle}</p>
          </div>
        </button>
        <div className="flex shrink-0 flex-col gap-0.5">
          <button
            type="button"
            onClick={() => setAddToPlaylistVideo(video)}
            className="rounded-lg p-2 text-muted-foreground hover:text-foreground"
            aria-label="Add to playlist"
          >
            <ListPlus size={16} />
          </button>
          <button
            type="button"
            onClick={() => void handleWatchLater(video)}
            className={`rounded-lg p-2 ${later ? 'text-amber-500' : 'text-muted-foreground'}`}
            aria-label={later ? 'Remove from Watch later' : 'Watch later'}
          >
            <Clock3 size={16} />
          </button>
          <button
            type="button"
            onClick={() => void handleFavorite(video)}
            className={`rounded-lg p-2 ${favorited ? 'text-pink-500' : 'text-muted-foreground'}`}
            aria-label={favorited ? 'Remove favorite' : 'Add favorite'}
          >
            <Heart size={16} className={favorited ? 'fill-current' : undefined} />
          </button>
          <button
            type="button"
            onClick={() => void handleLike(video)}
            className={`rounded-lg p-2 ${likedVideo ? 'text-cyan-500' : 'text-muted-foreground'}`}
            aria-label={likedVideo ? 'Unlike' : 'Like'}
          >
            <ThumbsUp size={16} className={likedVideo ? 'fill-current' : undefined} />
          </button>
          {options?.onRemove ? (
            <button
              type="button"
              onClick={options.onRemove}
              className="rounded-lg p-2 text-muted-foreground hover:text-red-500"
              aria-label="Remove"
            >
              <Trash2 size={16} />
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const renderVideoList = (videos: YoutubeVideoSummary[], empty: string) => {
    if (videos.length === 0) {
      return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
    }
    return <div className="space-y-3">{videos.map((video) => renderResultCard(video))}</div>;
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
          ) : null}
          <div className="flex items-center gap-2">
            <Youtube size={22} className="text-red-600" />
            <h1 className="text-lg font-black">YouTube</h1>
          </div>
        </div>
        <div className="mx-auto mt-3 flex max-w-5xl gap-1 overflow-x-auto pb-1">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setTab(entry.id);
                if (entry.id !== 'playlists') setActivePlaylistId(null);
                if (entry.id !== 'live') setLiveFullscreen(false);
              }}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                tab === entry.id
                  ? 'bg-red-600 text-white'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {configured === false ? (
          <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
            YouTube search needs <code className="font-mono">YOUTUBE_API_KEY</code> on the API server.
          </p>
        ) : null}

        {tab === 'search' ? (
          <>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void runSearch(query);
              }}
            >
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    if (!event.target.value.trim() && submittedQuery) {
                      setSubmittedQuery('');
                      setResults([]);
                      setNextPageToken(null);
                    }
                  }}
                  placeholder="Search videos, paste URL, or playlist link"
                  className="w-full rounded-2xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:border-red-500/50"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="rounded-2xl bg-red-600 px-5 text-sm font-black text-white disabled:opacity-50"
              >
                Search
              </button>
            </form>
          </>
        ) : null}

        {error ? <p className="text-sm font-bold text-red-500">{error}</p> : null}

        {liveFullscreen && activeVideo?.isLive ? (
          <YoutubeLiveFullscreenFeed
            videos={(activeQueue.length > 0 ? activeQueue : lives).filter(
              (entry) => entry.isLive !== false,
            )}
            index={activeQueueIndex}
            onIndexChange={(nextIndex) => {
              const queue = activeQueue.length > 0 ? activeQueue : lives;
              const next = queue[nextIndex];
              if (!next) return;
              setActiveVideo(next);
              setActiveQueue(queue);
              setActiveQueueIndex(nextIndex);
              setLiveFullscreen(true);
              void recordYoutubeHistory(next).then(refreshEngagement);
            }}
            onClose={() => setLiveFullscreen(false)}
            onNeedMore={loadMoreLivesForFullscreen}
            loadingMore={loadingMore || loadingLives}
          />
        ) : null}

        {activeVideo && !activeVideo.isLive && (tab !== 'shorts' || !shortsMode) ? (
          <section className="overflow-hidden rounded-2xl border border-border bg-black shadow-lg">
            <div className={shortsMode ? 'mx-auto aspect-[9/16] max-h-[70vh] w-full max-w-sm' : 'aspect-video w-full'}>
              <YouTube
                videoId={activeVideo.videoId}
                className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full"
                opts={{
                  width: '100%',
                  height: '100%',
                  playerVars: { ...YOUTUBE_PLAYER_VARS, loop: 0 },
                }}
                onReady={(event: YouTubeEvent) => applyYoutubePlayerVolume(event.target)}
                onStateChange={(event: YouTubeEvent) => stabilizeYoutubePlayerVolume(event.target)}
                onEnd={() => {
                  if (activeQueueIndex + 1 < activeQueue.length) {
                    playQueueOffset(1);
                  }
                }}
                title={activeVideo.title}
              />
            </div>
            <div className="space-y-2 bg-card px-4 py-3">
              <div className="flex items-center gap-2">
                {shortsMode ? (
                  <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                    Short
                  </span>
                ) : null}
                {activeVideo.liveBroadcastContent === 'upcoming' ? (
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                    Upcoming
                  </span>
                ) : null}
                <p className="text-sm font-black text-foreground">{activeVideo.title}</p>
              </div>
              <p className="text-xs text-muted-foreground">{activeVideo.channelTitle}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => playQueueOffset(-1)}
                  disabled={activeQueueIndex <= 0}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                >
                  <SkipBack size={14} /> Prev
                </button>
                <button
                  type="button"
                  onClick={() => playQueueOffset(1)}
                  disabled={activeQueueIndex >= activeQueue.length - 1}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                >
                  Next <SkipForward size={14} />
                </button>
                {activeQueue.length > 1 ? (
                  <span className="text-[11px] font-bold text-muted-foreground">
                    {activeQueueIndex + 1} / {activeQueue.length}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setAddToPlaylistVideo(activeVideo)}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-bold"
                >
                  <ListPlus size={14} /> Save
                </button>
                <button
                  type="button"
                  onClick={() => void handleWatchLater(activeVideo)}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-bold"
                >
                  <Clock3 size={14} /> Later
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {tab === 'shorts' ? (
          <section className="space-y-4">
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void loadShorts(shortsQuery.trim() || undefined);
              }}
            >
              <input
                value={shortsQuery}
                onChange={(event) => setShortsQuery(event.target.value)}
                placeholder="Search Shorts (or leave blank for trending)"
                className="flex-1 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-red-500/50"
              />
              <button
                type="submit"
                disabled={loadingShorts}
                className="rounded-2xl bg-red-600 px-4 text-sm font-black text-white disabled:opacity-50"
              >
                {loadingShorts ? '…' : 'Go'}
              </button>
            </form>

            {loadingShorts && shorts.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm font-bold">Loading Shorts…</span>
              </div>
            ) : null}

            {activeVideo && shortsMode ? (
              <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
                <div className="relative overflow-hidden rounded-3xl border border-border bg-black shadow-xl">
                  <div className="aspect-[9/16] w-full">
                    <YouTube
                      videoId={activeVideo.videoId}
                      className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full"
                      opts={{
                        width: '100%',
                        height: '100%',
                        playerVars: { ...YOUTUBE_PLAYER_VARS, controls: 1 },
                      }}
                      onReady={(event: YouTubeEvent) => applyYoutubePlayerVolume(event.target)}
                      onStateChange={(event: YouTubeEvent) => stabilizeYoutubePlayerVolume(event.target)}
                      onEnd={() => {
                        playNextShort();
                      }}
                      title={activeVideo.title}
                    />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-16">
                    <p className="line-clamp-2 text-sm font-black text-white">{activeVideo.title}</p>
                    <p className="mt-1 text-xs text-white/70">{activeVideo.channelTitle}</p>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={shortsIndex <= 0}
                    onClick={() => {
                      const prev = shortsIndex - 1;
                      if (prev >= 0) void playVideo(shorts[prev], shorts, prev);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-xs font-bold disabled:opacity-40"
                  >
                    <SkipBack size={14} /> Prev
                  </button>
                  <span className="text-[11px] font-bold text-muted-foreground">
                    {shorts.length ? `${shortsIndex + 1} / ${shorts.length}` : '0'}
                  </span>
                  <button
                    type="button"
                    onClick={() => playNextShort()}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-xs font-bold"
                  >
                    Next <SkipForward size={14} />
                  </button>
                </div>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleLike(activeVideo)}
                    className={`rounded-full border border-border p-2 ${isYoutubeLiked(activeVideo.videoId) ? 'text-cyan-500' : ''}`}
                    aria-label="Like"
                  >
                    <ThumbsUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleFavorite(activeVideo)}
                    className={`rounded-full border border-border p-2 ${isYoutubeFavorite(activeVideo.videoId) ? 'text-pink-500' : ''}`}
                    aria-label="Favorite"
                  >
                    <Heart size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleWatchLater(activeVideo)}
                    className={`rounded-full border border-border p-2 ${isYoutubeWatchLater(activeVideo.videoId) ? 'text-amber-500' : ''}`}
                    aria-label="Watch later"
                  >
                    <Clock3 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddToPlaylistVideo(activeVideo)}
                    className="rounded-full border border-border p-2"
                    aria-label="Add to playlist"
                  >
                    <ListPlus size={16} />
                  </button>
                </div>
              </div>
            ) : null}

            {!loadingShorts && shorts.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {shorts.map((video, index) => (
                  <button
                    key={`${video.videoId}-${index}`}
                    type="button"
                    onClick={() => void playVideo(video, shorts, index)}
                    className={`overflow-hidden rounded-2xl border text-left transition ${
                      shortsIndex === index && shortsMode
                        ? 'border-red-500 ring-2 ring-red-500/30'
                        : 'border-border'
                    }`}
                  >
                    <div className="aspect-[9/16] bg-black/40">
                      {video.thumbnailUrl ? (
                        <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="p-2">
                      <p className="line-clamp-2 text-[11px] font-bold">{video.title}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {shortsNextToken ? (
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadShorts(shortsQuery.trim() || undefined, shortsNextToken)}
                className="w-full rounded-2xl border border-border py-3 text-sm font-bold text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more Shorts'}
              </button>
            ) : null}
          </section>
        ) : null}

        {tab === 'live' ? (
          <section className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setLivesEventType('live');
                  setLives([]);
                  void loadLives(livesQuery.trim() || undefined, undefined, 'live');
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  livesEventType === 'live'
                    ? 'bg-red-600 text-white'
                    : 'bg-muted/60 text-muted-foreground'
                }`}
              >
                Live now
              </button>
              <button
                type="button"
                onClick={() => {
                  setLivesEventType('upcoming');
                  setLives([]);
                  void loadLives(livesQuery.trim() || undefined, undefined, 'upcoming');
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  livesEventType === 'upcoming'
                    ? 'bg-amber-500 text-white'
                    : 'bg-muted/60 text-muted-foreground'
                }`}
              >
                Upcoming
              </button>
              <p className="self-center text-[11px] font-bold text-muted-foreground">
                Official YouTube Live · not UniLive’s rooms
              </p>
            </div>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setLives([]);
                void loadLives(livesQuery.trim() || undefined, undefined, livesEventType);
              }}
            >
              <input
                value={livesQuery}
                onChange={(event) => setLivesQuery(event.target.value)}
                placeholder="Search YouTube Live (news, gaming, music…)"
                className="flex-1 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-red-500/50"
              />
              <button
                type="submit"
                disabled={loadingLives}
                className="rounded-2xl bg-red-600 px-4 text-sm font-black text-white disabled:opacity-50"
              >
                {loadingLives ? '…' : 'Go'}
              </button>
            </form>

            {loadingLives && lives.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm font-bold">Finding live streams…</span>
              </div>
            ) : null}

            {!loadingLives && lives.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No {livesEventType === 'upcoming' ? 'upcoming' : 'live'} streams found. Try another search.
              </p>
            ) : null}

            {lives.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {lives.map((video) => (
                  <button
                    key={video.videoId}
                    type="button"
                    onClick={() => {
                      setShortsMode(false);
                      void playVideo(
                        { ...video, isLive: video.isLive ?? livesEventType === 'live' },
                        lives,
                        lives.findIndex((entry) => entry.videoId === video.videoId),
                      );
                    }}
                    className={`overflow-hidden rounded-2xl border text-left transition ${
                      activeVideo?.videoId === video.videoId
                        ? 'border-red-500 ring-2 ring-red-500/30'
                        : 'border-border'
                    }`}
                  >
                    <div className="relative aspect-video bg-black/40">
                      {video.thumbnailUrl ? (
                        <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      ) : null}
                      <div className="absolute left-2 top-2 flex items-center gap-1">
                        {video.isLive || livesEventType === 'live' ? (
                          <span className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-black uppercase text-white">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                            Live
                          </span>
                        ) : (
                          <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-black uppercase text-white">
                            Upcoming
                          </span>
                        )}
                        {typeof video.concurrentViewers === 'number' ? (
                          <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {video.concurrentViewers.toLocaleString()} watching
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-0.5 p-3">
                      <p className="line-clamp-2 text-sm font-bold">{video.title}</p>
                      <p className="text-xs text-muted-foreground">{video.channelTitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {livesNextToken ? (
              <button
                type="button"
                disabled={loadingMore}
                onClick={() =>
                  void loadLives(livesQuery.trim() || undefined, livesNextToken, livesEventType)
                }
                className="w-full rounded-2xl border border-border py-3 text-sm font-bold text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            ) : null}
          </section>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm font-bold">Loading…</span>
          </div>
        ) : null}

        {tab === 'search' && !loading && results.length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Results for “{submittedQuery}”
            </h2>
            <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((video, index) => renderFeedCard(video, results, index))}
            </div>
            {nextPageToken ? (
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void runSearch(submittedQuery, nextPageToken)}
                className="w-full rounded-2xl border border-border py-3 text-sm font-bold text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            ) : null}
          </section>
        ) : null}

        {tab === 'search' && !loading && !submittedQuery ? (
          <section className="space-y-6">
            {loadingFeed && homeFeed.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm font-bold">Loading feed…</span>
              </div>
            ) : null}

            {homeLives.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Live now
                  </h2>
                  <button
                    type="button"
                    onClick={() => setTab('live')}
                    className="text-xs font-bold text-red-600"
                  >
                    See all
                  </button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                  {homeLives.map((video) => (
                    <button
                      key={`home-live-${video.videoId}`}
                      type="button"
                      onClick={() => void playVideo(video, homeLives, homeLives.indexOf(video))}
                      className="w-56 shrink-0 overflow-hidden rounded-2xl border border-border bg-card text-left"
                    >
                      <div className="relative aspect-video bg-black/40">
                        {video.thumbnailUrl ? (
                          <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                          Live
                        </span>
                      </div>
                      <div className="p-2.5">
                        <p className="line-clamp-2 text-xs font-bold">{video.title}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{video.channelTitle}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {homeShorts.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Shorts
                  </h2>
                  <button
                    type="button"
                    onClick={() => setTab('shorts')}
                    className="text-xs font-bold text-red-600"
                  >
                    See all
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {homeShorts.map((video, index) => (
                    <button
                      key={`home-short-${video.videoId}-${index}`}
                      type="button"
                      onClick={() => {
                        setTab('shorts');
                        setShorts(homeShorts);
                        void playVideo(video, homeShorts, index);
                      }}
                      className="w-28 shrink-0 overflow-hidden rounded-2xl border border-border bg-card text-left"
                    >
                      <div className="aspect-[9/16] bg-black/40">
                        {video.thumbnailUrl ? (
                          <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <p className="line-clamp-2 p-1.5 text-[10px] font-bold">{video.title}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {homeFeed.length > 0 ? (
              <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Recommended
                </h2>
                <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                  {homeFeed.map((video, index) => renderFeedCard(video, homeFeed, index))}
                </div>
                {homeFeedNext ? (
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void loadHomeFeed(homeFeedNext)}
                    className="w-full rounded-2xl border border-border py-3 text-sm font-bold text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-3 rounded-2xl border border-dashed border-border p-4">
              <p className="text-sm font-bold text-foreground">Import a playlist</p>
              <p className="text-xs text-muted-foreground">
                Paste a YouTube playlist URL to save it into your library.
              </p>
              <div className="flex gap-2">
                <input
                  value={playlistUrl}
                  onChange={(event) => setPlaylistUrl(event.target.value)}
                  placeholder="https://www.youtube.com/playlist?list=PL…"
                  className="flex-1 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-red-500/50"
                />
                <button
                  type="button"
                  disabled={importingPlaylist || !playlistUrl.trim()}
                  onClick={() => void importPublicPlaylist()}
                  className="rounded-2xl bg-red-600 px-4 text-sm font-black text-white disabled:opacity-50"
                >
                  {importingPlaylist ? 'Importing…' : 'Import'}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {tab === 'playlists' ? (
          <section className="space-y-4">
            {activePlaylist ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActivePlaylistId(null)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-bold"
                  >
                    ← All playlists
                  </button>
                  <h2 className="text-sm font-black">{activePlaylist.title}</h2>
                  <span className="text-xs text-muted-foreground">{activePlaylist.items.length} videos</span>
                  {activePlaylist.items.length > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        void playVideo(activePlaylist.items[0], activePlaylist.items, 0)
                      }
                      className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-black text-white"
                    >
                      <Play size={12} /> Play all
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      const next = window.prompt('Rename playlist', activePlaylist.title);
                      if (next?.trim()) void renameYoutubePlaylist(activePlaylist.id, next);
                    }}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-bold"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete “${activePlaylist.title}”?`)) {
                        void deleteYoutubePlaylist(activePlaylist.id).then(() =>
                          setActivePlaylistId(null),
                        );
                      }
                    }}
                    className="rounded-full border border-red-500/40 px-3 py-1.5 text-xs font-bold text-red-500"
                  >
                    Delete
                  </button>
                </div>
                <div className="space-y-3">
                  {activePlaylist.items.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Empty playlist — add videos from Search.
                    </p>
                  ) : (
                    activePlaylist.items.map((video) =>
                      renderResultCard(video, {
                        onRemove: () => {
                          void removeVideoFromYoutubePlaylist(activePlaylist.id, video.videoId);
                        },
                      }),
                    )
                  )}
                </div>
              </>
            ) : (
              <>
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!newPlaylistTitle.trim()) return;
                    void createYoutubePlaylist(newPlaylistTitle).then((created) => {
                      setNewPlaylistTitle('');
                      setActivePlaylistId(created.id);
                    });
                  }}
                >
                  <input
                    value={newPlaylistTitle}
                    onChange={(event) => setNewPlaylistTitle(event.target.value)}
                    placeholder="New playlist name"
                    className="flex-1 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-red-500/50"
                  />
                  <button
                    type="submit"
                    disabled={!newPlaylistTitle.trim()}
                    className="inline-flex items-center gap-1 rounded-2xl bg-red-600 px-4 text-sm font-black text-white disabled:opacity-50"
                  >
                    <Plus size={16} /> Create
                  </button>
                </form>

                <div className="flex gap-2">
                  <input
                    value={playlistUrl}
                    onChange={(event) => setPlaylistUrl(event.target.value)}
                    placeholder="Import public playlist URL"
                    className="flex-1 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-red-500/50"
                  />
                  <button
                    type="button"
                    disabled={importingPlaylist || !playlistUrl.trim()}
                    onClick={() => void importPublicPlaylist()}
                    className="rounded-2xl border border-border px-4 text-sm font-bold disabled:opacity-50"
                  >
                    Import
                  </button>
                </div>

                {playlists.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No playlists yet. Create one or import a YouTube playlist URL.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {playlists.map((playlist) => (
                      <PlaylistCard
                        key={playlist.id}
                        playlist={playlist}
                        onOpen={() => setActivePlaylistId(playlist.id)}
                        onPlay={() => {
                          if (playlist.items[0]) {
                            void playVideo(playlist.items[0], playlist.items, 0);
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        ) : null}

        {tab === 'watch_later' ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Watch later
              </h2>
              {watchLater.length > 0 ? (
                <button
                  type="button"
                  onClick={() => void playVideo(watchLater[0], watchLater, 0)}
                  className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-black text-white"
                >
                  <Play size={12} /> Play all
                </button>
              ) : null}
            </div>
            {renderVideoList(watchLater, 'Nothing saved for later yet.')}
          </section>
        ) : null}

        {tab === 'liked' ? (
          <section className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Liked</h2>
            {renderVideoList(liked, 'No liked videos yet.')}
          </section>
        ) : null}

        {tab === 'favorites' ? (
          <section className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Favorites
            </h2>
            {renderVideoList(favorites, 'No favorites yet.')}
          </section>
        ) : null}

        {tab === 'history' ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                History
              </h2>
              {history.length > 0 ? (
                <button
                  type="button"
                  onClick={() => void clearYoutubeHistory()}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground"
                >
                  Clear
                </button>
              ) : null}
            </div>
            {renderVideoList(history, 'Watch history is empty.')}
          </section>
        ) : null}
      </div>

      {addToPlaylistVideo ? (
        <AddToPlaylistSheet
          video={addToPlaylistVideo}
          playlists={playlists}
          onClose={() => setAddToPlaylistVideo(null)}
          onCreated={(id) => {
            setActivePlaylistId(id);
            setTab('playlists');
          }}
        />
      ) : null}
    </div>
  );
}

function PlaylistCard({
  playlist,
  onOpen,
  onPlay,
}: {
  playlist: YoutubePlaylist;
  onOpen: () => void;
  onPlay: () => void;
}) {
  const cover = playlist.items[0]?.thumbnailUrl;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="aspect-video bg-black/40">
          {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <ListMusic size={28} />
            </div>
          )}
        </div>
        <div className="px-3 py-2">
          <p className="truncate text-sm font-black">{playlist.title}</p>
          <p className="text-[11px] text-muted-foreground">{playlist.items.length} videos</p>
        </div>
      </button>
      {playlist.items.length > 0 ? (
        <button
          type="button"
          onClick={onPlay}
          className="flex w-full items-center justify-center gap-1 border-t border-border py-2 text-xs font-bold text-red-600"
        >
          <Play size={12} /> Play
        </button>
      ) : null}
    </div>
  );
}
