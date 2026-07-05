import React, { useCallback, useEffect, useMemo, useState } from 'react';
import YouTube from 'react-youtube';
import { ArrowLeft, Heart, Loader2, Search, ThumbsUp, Youtube } from 'lucide-react';
import {
  isYoutubeFavorite,
  isYoutubeLiked,
  isYoutubeSearchConfigured,
  readYoutubeEngagement,
  recordYoutubeHistory,
  searchYoutubeVideos,
  toggleYoutubeFavorite,
  toggleYoutubeLike,
  type YoutubeVideoSummary,
} from '../services/youtube';
import { useCloudAuth } from '../contexts/CloudAuthContext';
import { migrateFirebaseNewcomerToSupabase } from '../lib/auth/migrateFirebaseNewcomer';
import { getFirebaseAuth } from '../lib/firebase/app';
import { db } from '../lib/db/localDb';
import { isSupabaseAuthUserId } from '../lib/auth/activeBackend';

type YouTubePageProps = {
  onBack?: () => void;
};

export function YouTubePage({ onBack }: YouTubePageProps) {
  const { authReady } = useCloudAuth();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState<YoutubeVideoSummary[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<YoutubeVideoSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [engagementTick, setEngagementTick] = useState(0);

  const favorites = useMemo(() => readYoutubeEngagement('favorite'), [engagementTick]);
  const history = useMemo(() => readYoutubeEngagement('history'), [engagementTick]);

  useEffect(() => {
    if (!authReady) return;
    void isYoutubeSearchConfigured().then(setConfigured);
    const meId = db.currentUserId;
    if (meId && !isSupabaseAuthUserId(meId)) {
      const fbUid = getFirebaseAuth()?.currentUser?.uid;
      if (fbUid === meId) {
        void migrateFirebaseNewcomerToSupabase(fbUid).catch(() => false);
      }
    }
  }, [authReady]);

  const ensureApiAuth = useCallback(async (): Promise<void> => {
    const meId = db.currentUserId;
    if (!meId || isSupabaseAuthUserId(meId)) return;
    const fbUid = getFirebaseAuth()?.currentUser?.uid;
    if (fbUid === meId) {
      await migrateFirebaseNewcomerToSupabase(fbUid).catch(() => false);
    }
  }, []);

  const refreshEngagement = useCallback(() => {
    setEngagementTick((tick) => tick + 1);
  }, []);

  const runSearch = async (searchQuery: string, pageToken?: string) => {
    const q = searchQuery.trim();
    if (!q) return;
    if (pageToken) setLoadingMore(true);
    else {
      setLoading(true);
      setError(null);
    }

    try {
      await ensureApiAuth();
      const response = await searchYoutubeVideos(q, pageToken);
      setResults((prev) => (pageToken ? [...prev, ...response.items] : response.items));
      setNextPageToken(response.nextPageToken);
      if (!pageToken) setSubmittedQuery(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      if (!pageToken) setResults([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const playVideo = async (video: YoutubeVideoSummary) => {
    setActiveVideo(video);
    await recordYoutubeHistory(video);
    refreshEngagement();
  };

  const handleFavorite = async (video: YoutubeVideoSummary) => {
    await toggleYoutubeFavorite(video);
    refreshEngagement();
  };

  const handleLike = async (video: YoutubeVideoSummary) => {
    await toggleYoutubeLike(video);
    refreshEngagement();
  };

  const renderResultCard = (video: YoutubeVideoSummary) => {
    const favorited = isYoutubeFavorite(video.videoId);
    const liked = isYoutubeLiked(video.videoId);

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
            <p className="line-clamp-2 text-sm font-bold text-foreground">{video.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{video.channelTitle}</p>
          </div>
        </button>
        <div className="flex shrink-0 flex-col gap-1">
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
            className={`rounded-lg p-2 ${liked ? 'text-cyan-500' : 'text-muted-foreground'}`}
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            <ThumbsUp size={16} className={liked ? 'fill-current' : undefined} />
          </button>
        </div>
      </div>
    );
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
      </header>

      <div className="mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {configured === false ? (
          <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
            YouTube search needs <code className="font-mono">YOUTUBE_API_KEY</code> on the API server.
          </p>
        ) : null}

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch(query);
          }}
        >
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search YouTube"
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

        {error ? <p className="text-sm font-bold text-red-500">{error}</p> : null}

        {activeVideo ? (
          <section className="overflow-hidden rounded-2xl border border-border bg-black shadow-lg">
            <div className="aspect-video w-full">
              <YouTube
                videoId={activeVideo.videoId}
                className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full"
                opts={{
                  width: '100%',
                  height: '100%',
                  playerVars: { autoplay: 1, modestbranding: 1, rel: 0, playsinline: 1 },
                }}
                title={activeVideo.title}
              />
            </div>
            <div className="space-y-1 bg-card px-4 py-3">
              <p className="text-sm font-black text-foreground">{activeVideo.title}</p>
              <p className="text-xs text-muted-foreground">{activeVideo.channelTitle}</p>
            </div>
          </section>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm font-bold">Searching…</span>
          </div>
        ) : null}

        {!loading && results.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Results for “{submittedQuery}”
            </h2>
            {results.map(renderResultCard)}
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

        {!loading && results.length === 0 && favorites.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Favorites</h2>
            {favorites.map(renderResultCard)}
          </section>
        ) : null}

        {!loading && results.length === 0 && history.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">History</h2>
            {history.map(renderResultCard)}
          </section>
        ) : null}
      </div>
    </div>
  );
}
