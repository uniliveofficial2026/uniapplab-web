import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  Music,
  Hash,
  UserCircle2,
  Play,
  Loader2,
  Youtube,
  Radio,
} from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { handleAvatarError } from '../../lib/utils';
import { useDiscoverableUserSearch } from '../../hooks/useDiscoverableUserSearch';
import { isCloudAuthConfigured, isPrimarySupabaseCloud } from '../../lib/auth/config';

import { PostModal } from '../feed/PostModal';

import { openProfilePreview } from '../../lib/utils';
import { ProfileNameLines } from '../common/ProfileNameLines';
import { UniLivesVerificationBadge } from '../identity/brand/UniLivesVerificationBadge';
import { isPostActive } from '../../lib/entityResolve';
import { resolveProfileGridPost } from '../../lib/profilePostGrid';
import { SafeMediaImage } from '../common/SafeMediaImage';
import { safeAvatarUrl } from '../../lib/safe';
import type { User } from '../../types';
import { snapshotPostPlayback } from '../../lib/postPlayback';
import { syncCloudSocialFeed } from '../../lib/cloudSocial/cloudSocialContent';
import { useLiveCloudSurface } from '../../hooks/useLiveCloudSurface';
import {
  fetchYoutubePopular,
  isYoutubeSearchConfigured,
  recordYoutubeHistory,
  searchYoutubeLive,
  searchYoutubeShorts,
  searchYoutubeVideos,
  fetchAllYoutubePlaylistItems,
  isPlayableYoutubeVideo,
  youtubeResultKey,
  type YoutubeVideoSummary,
} from '../../services/youtube';
import { YoutubeSearchFilterBar } from '../youtube/YoutubeSearchFilterBar';
import {
  countYoutubeSearchFilters,
  type YoutubeSearchFilters,
} from '../../lib/youtubeSearchFilters';
import { playYoutubeMiniVideo } from '../../lib/youtubeMiniPlayer';
import {
  UniLivesDiscoverySearch,
  UniLivesDiscoveryTabs,
} from '../discovery/brand';

export type SearchTab = 'top' | 'accounts' | 'audio' | 'tags' | 'places' | 'youtube';

type YoutubeFeedMode = 'videos' | 'shorts' | 'live';

const SEARCH_TAB_IDS: SearchTab[] = ['top', 'accounts', 'audio', 'tags', 'places', 'youtube'];

function isSearchTab(value: string | undefined): value is SearchTab {
  return Boolean(value && SEARCH_TAB_IDS.includes(value as SearchTab));
}

export function SearchScreen({
  initialContext,
  onClearContext,
}: {
  initialContext?: { query?: string; tab?: SearchTab } | null;
  onClearContext?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('top');

  useEffect(() => {
    if (initialContext) {
      if (initialContext.query) setQuery(initialContext.query);
      if (isSearchTab(initialContext.tab)) setActiveTab(initialContext.tab);
      onClearContext?.();
    }
  }, [initialContext, onClearContext]);

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const db = useDB();
  const POSTS = db.posts;
  const { results: searchUsers } = useDiscoverableUserSearch(query);
  const cloudSearchEnabled = isPrimarySupabaseCloud() || isCloudAuthConfigured();
  const { showToast } = useToast();

  useLiveCloudSurface('search', () => {
    void syncCloudSocialFeed();
  });

  const explorePosts = useMemo(
    () =>
      POSTS.filter((raw) => isPostActive(raw)).map((raw) =>
        resolveProfileGridPost(raw, db),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [POSTS, db.posts, db.users, db.postComments],
  );

  const toggleFollow = (user: User, e: React.MouseEvent) => {
    e.stopPropagation();
    db.toggleFollow(user.id);
  };

  const playYoutube = useCallback(
    async (video: YoutubeVideoSummary, queue?: YoutubeVideoSummary[], index = 0) => {
      const list = queue && queue.length > 0 ? queue : [video];
      const safeIndex = Math.max(0, Math.min(index, list.length - 1));
      const current = list[safeIndex] ?? video;
      if (!isPlayableYoutubeVideo(current)) return;
      playYoutubeMiniVideo(current, { queue: list, queueIndex: safeIndex });
      await recordYoutubeHistory(current);
      showToast(`Playing ${current.title}`);
    },
    [showToast],
  );

  const tabs: { id: SearchTab; label: string; icon?: React.ReactNode }[] = [
    { id: 'top', label: 'Top' },
    { id: 'accounts', label: 'Accounts', icon: <UserCircle2 className="w-4 h-4" /> },
    { id: 'youtube', label: 'YouTube', icon: <Youtube className="w-4 h-4" /> },
    { id: 'audio', label: 'Audio', icon: <Music className="w-4 h-4" /> },
    { id: 'tags', label: 'Tags', icon: <Hash className="w-4 h-4" /> },
    { id: 'places', label: 'Places', icon: <MapPin className="w-4 h-4" /> },
  ];

  const showExploreGrid = !query && activeTab !== 'youtube';

  return (
    <div className="w-full min-h-0 flex-1 flex flex-col bg-[color:var(--color-unilives-discovery-background)]">
    <div className="app-screen-scroll w-full flex flex-col pt-6 app-content-gutter md:px-0 max-w-[600px] mx-auto min-h-0">
      <UniLivesDiscoverySearch
        value={query}
        onChange={setQuery}
        placeholder={
          activeTab === 'youtube'
            ? 'Search YouTube videos, Shorts, or live…'
            : 'Search...'
        }
      />

      <UniLivesDiscoveryTabs
        tabs={tabs}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as SearchTab)}
      />

      <div className="flex-1 pb-6 w-full">
        {showExploreGrid ? (
          <div className="grid grid-cols-3 gap-1 md:gap-2">
            {explorePosts.map((post, i) => {
              const isLarge = i % 10 === 0;
              const isTall = i % 7 === 0 && !isLarge;

              return (
                <div
                  key={post.id}
                  onClick={() => {
                    snapshotPostPlayback(post.id, 'modal');
                    setSelectedPostId(post.id);
                  }}
                  className={`bg-[color:var(--color-unilives-discovery-surface)] relative group cursor-pointer overflow-hidden rounded-xl ${
                    isLarge
                      ? 'col-span-2 row-span-2 aspect-square'
                      : isTall
                        ? 'row-span-2 aspect-[1/2]'
                        : 'aspect-square'
                  }`}
                >
                  <SafeMediaImage
                    src={post.thumbUrl}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                  {post.isVideo ? (
                    <div className="absolute top-2 right-2 text-white drop-shadow-md pointer-events-none">
                      <Play className="w-4 h-4 fill-white" />
                    </div>
                  ) : null}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white backdrop-blur-[2px] motion-reduce:transition-none">
                    <span className="font-bold text-lg flex items-center gap-2 tabular-nums">
                      {post.likes.toLocaleString()} ♥
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : activeTab === 'youtube' ? (
          <SearchYoutubeFeed query={query} onPlay={playYoutube} />
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {activeTab === 'top' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-black text-lg">Top Accounts</h3>
                  {searchUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-2">
                      {isPrimarySupabaseCloud()
                        ? 'No accounts match that search. Users appear here after they finish profile setup (Continue on the setup screen).'
                        : cloudSearchEnabled
                          ? 'No accounts match that search. New users appear after they finish profile setup on a cloud-connected app.'
                          : 'No accounts on this device match that search. Local demo sign-ups are only stored in this browser — configure Supabase auth for cross-device discovery.'}
                    </p>
                  ) : null}
                  {searchUsers.map((user, i) => (
                    <div
                      key={'top-user-' + user.id || i}
                      className="flex items-center justify-between hover:bg-secondary/50 p-2 rounded-xl cursor-pointer"
                      onClick={() => openProfilePreview(user)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden border border-border">
                          <img
                            src={safeAvatarUrl(user.avatarUrl)}
                            className="w-full h-full object-cover"
                            onError={handleAvatarError}
                          />
                        </div>
                        <div className="flex flex-col">
                          <ProfileNameLines
                            user={user}
                            primaryClassName="font-bold text-[15px] flex items-center gap-1"
                            secondaryClassName="text-sm text-muted-foreground"
                            premiumBadge={
                              <UniLivesVerificationBadge
                                isVerified={!!user.isVerified}
                                userId={user.id}
                                iconClassName="w-3.5 h-3.5 text-primary"
                              />
                            }
                          />
                          <span className="text-sm text-muted-foreground">
                            {(user.followers ?? 0).toLocaleString()} followers
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {searchUsers.length > 0 && (
                    <button
                      onClick={() => setActiveTab('accounts')}
                      className="w-full text-primary font-bold text-sm py-2"
                    >
                      See all results
                    </button>
                  )}
                </div>

                <SearchYoutubeTopTeaser
                  query={query}
                  onPlay={playYoutube}
                  onSeeAll={() => setActiveTab('youtube')}
                />

                <div className="space-y-4 pt-4 border-t border-border">
                  <h3 className="font-black text-lg">Suggested Tags</h3>
                  <div className="flex items-center justify-between hover:bg-secondary/50 p-2 rounded-xl cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center">
                        <Hash className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-[15px]">#{query}</span>
                        <span className="text-sm text-muted-foreground">Explore related posts</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'accounts' && (
              <div className="space-y-2">
                {searchUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-3 py-2">No matching accounts.</p>
                ) : null}
                {searchUsers.map((user, i) => (
                  <div
                    key={'user-' + user.id || i}
                    className="flex items-center justify-between hover:bg-secondary/50 p-3 rounded-xl cursor-pointer"
                    onClick={() => openProfilePreview(user)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full overflow-hidden border border-border">
                        <img
                          src={safeAvatarUrl(user.avatarUrl)}
                          className="w-full h-full object-cover"
                          onError={handleAvatarError}
                        />
                      </div>
                      <div className="flex flex-col">
                        <ProfileNameLines
                          user={user}
                          primaryClassName="font-bold text-[16px] flex items-center gap-1"
                          secondaryClassName="text-[14px] text-muted-foreground font-medium"
                          premiumBadge={
                            <UniLivesVerificationBadge
                              isVerified={!!user.isVerified}
                              userId={user.id}
                              iconClassName="w-3.5 h-3.5 text-primary"
                            />
                          }
                        />
                        <span className="text-[12px] text-muted-foreground mt-0.5">
                          {(user.followers ?? 0).toLocaleString()} followers
                        </span>
                      </div>
                    </div>
                    {user.id !== db.currentUser?.id && (
                      <button
                        onClick={(e) => toggleFollow(user, e)}
                        className={`px-5 py-1.5 font-bold rounded-lg text-sm transition-colors active:scale-95 ${
                          user.isFollowing
                            ? 'bg-secondary text-foreground border border-border'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90'
                        }`}
                      >
                        {user.isFollowing ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={'audio-' + i}
                    className="flex items-center justify-between hover:bg-secondary/50 p-3 rounded-xl cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-border bg-secondary flex items-center justify-center shrink-0">
                        <Music className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-[16px]">
                          {query} Remix vol {i + 1}
                        </span>
                        <span className="text-[14px] text-muted-foreground font-medium">
                          Creator {i + 1}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'tags' && (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={'tag-' + i}
                    className="flex items-center justify-between hover:bg-secondary/50 p-3 rounded-xl cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full overflow-hidden border border-border bg-secondary flex items-center justify-center shrink-0">
                        <Hash className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-[16px]">
                          #{query}
                          {['vibes', 'life', 'daily', 'explore', 'style', 'music'][i]}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'places' && (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={'place-' + i}
                    className="flex items-center justify-between hover:bg-secondary/50 p-3 rounded-xl cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full overflow-hidden border border-border bg-secondary flex items-center justify-center shrink-0">
                        <MapPin className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-[16px]">
                          {query}{' '}
                          {i === 0
                            ? 'City'
                            : i === 1
                              ? 'Cafe'
                              : i === 2
                                ? 'Studio'
                                : i === 3
                                  ? 'Park'
                                  : 'Central'}
                        </span>
                        <span className="text-[14px] text-muted-foreground font-medium">
                          Location
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedPostId && (
        <PostModal postId={selectedPostId} onClose={() => setSelectedPostId(null)} />
      )}
    </div>
    </div>
  );
}

function SearchYoutubeTopTeaser({
  query,
  onPlay,
  onSeeAll,
}: {
  query: string;
  onPlay: (video: YoutubeVideoSummary, queue?: YoutubeVideoSummary[], index?: number) => void;
  onSeeAll: () => void;
}) {
  const [items, setItems] = useState<YoutubeVideoSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const q = query.trim();
    if (!q) {
      setItems([]);
      return;
    }
    setLoading(true);
    void searchYoutubeVideos(q)
      .then((res) => {
        if (!cancelled) setItems(res.items.slice(0, 4));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (!query.trim()) return null;
  if (!loading && items.length === 0) return null;

  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-lg flex items-center gap-2">
          <Youtube className="w-5 h-5 text-red-600" /> YouTube
        </h3>
        <button type="button" onClick={onSeeAll} className="text-primary font-bold text-sm">
          See all
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Searching YouTube…
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((video, index) => (
            <YoutubeResultRow
              key={video.videoId}
              video={video}
              onPlay={() => onPlay(video, items, index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchYoutubeFeed({
  query,
  onPlay,
}: {
  query: string;
  onPlay: (video: YoutubeVideoSummary, queue?: YoutubeVideoSummary[], index?: number) => void;
}) {
  const [mode, setMode] = useState<YoutubeFeedMode>('videos');
  const [filters, setFilters] = useState<YoutubeSearchFilters>({});
  const [items, setItems] = useState<YoutubeVideoSummary[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void isYoutubeSearchConfigured().then(setConfigured);
  }, []);

  const load = useCallback(
    async (pageToken?: string) => {
      if (pageToken) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const q = query.trim();
        const response =
          mode === 'shorts'
            ? await searchYoutubeShorts(q || undefined, pageToken)
            : mode === 'live'
              ? await searchYoutubeLive(q || undefined, pageToken, 'live')
              : q || countYoutubeSearchFilters(filters) > 0
                ? await searchYoutubeVideos(q, pageToken, filters)
                : await fetchYoutubePopular(pageToken);
        const nextItems =
          mode === 'shorts'
            ? response.items.map((item) => ({ ...item, isShort: true }))
            : mode === 'live'
              ? response.items.map((item) => ({ ...item, isLive: true }))
              : response.items;
        setItems((prev) => (pageToken ? [...prev, ...nextItems] : nextItems));
        setNextPageToken(response.nextPageToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'YouTube search failed');
        if (!pageToken) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [mode, query, filters],
  );

  useEffect(() => {
    if (configured === false) return;
    void load();
  }, [configured, load]);

  if (configured === false) {
    return (
      <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
        YouTube needs <code className="font-mono">YOUTUBE_API_KEY</code> on the API server.
      </p>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-2">
        {(
          [
            { id: 'videos', label: 'Videos' },
            { id: 'shorts', label: 'Shorts' },
            { id: 'live', label: 'Live' },
          ] as const
        ).map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setMode(entry.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              mode === entry.id
                ? 'bg-red-600 text-white'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {mode === 'videos' ? (
        <YoutubeSearchFilterBar value={filters} onChange={setFilters} />
      ) : null}

      {error ? <p className="text-sm font-bold text-red-500">{error}</p> : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-bold">Loading YouTube…</span>
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No YouTube {mode} found{query.trim() ? ` for “${query.trim()}”` : ''}.
        </p>
      ) : null}

      {!loading && items.length > 0 ? (
        mode === 'shorts' ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {items.map((video, index) => (
              <button
                key={`${video.videoId}-${index}`}
                type="button"
                onClick={() => onPlay(video, items, index)}
                className="overflow-hidden rounded-2xl border border-border bg-card text-left"
              >
                <div className="relative aspect-[9/16] bg-secondary">
                  {video.thumbnailUrl ? (
                    <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                  <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                    Short
                  </span>
                </div>
                <div className="p-2">
                  <p className="line-clamp-2 text-[11px] font-bold">{video.title}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((video, index) => (
              <YoutubeResultRow
                key={`${youtubeResultKey(video)}-${index}`}
                video={video}
                onPlay={() => {
                  if (video.kind === 'channel' && video.channelId) {
                    setFilters((prev) => ({ ...prev, type: 'video', channelId: video.channelId }));
                    return;
                  }
                  if (video.kind === 'playlist' && video.playlistId) {
                    void fetchAllYoutubePlaylistItems(video.playlistId).then((playlistItems) => {
                      if (playlistItems[0]) onPlay(playlistItems[0], playlistItems, 0);
                    });
                    return;
                  }
                  onPlay(video, items, index);
                }}
              />
            ))}
          </div>
        )
      ) : null}

      {nextPageToken ? (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => void load(nextPageToken)}
          className="w-full rounded-2xl border border-border py-3 text-sm font-bold text-muted-foreground hover:bg-secondary disabled:opacity-50"
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      ) : null}
    </div>
  );
}

function YoutubeResultRow({
  video,
  onPlay,
}: {
  video: YoutubeVideoSummary;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card/60 p-2.5 text-left transition hover:bg-secondary/60"
    >
      <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-secondary">
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Play className="h-6 w-6 fill-white text-white drop-shadow" />
        </div>
        {video.kind === 'channel' ? (
          <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
            Channel
          </span>
        ) : null}
        {video.kind === 'playlist' ? (
          <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
            Playlist
          </span>
        ) : null}
        {video.isLive ? (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
            <Radio className="h-2.5 w-2.5" /> Live
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-bold text-foreground">{video.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{video.channelTitle}</p>
        {typeof video.concurrentViewers === 'number' ? (
          <p className="mt-0.5 text-[11px] font-semibold text-red-600">
            {video.concurrentViewers.toLocaleString()} watching
          </p>
        ) : null}
      </div>
    </button>
  );
}
