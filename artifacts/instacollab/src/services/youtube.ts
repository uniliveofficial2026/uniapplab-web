import { getSupabaseClient } from '../lib/supabase/client';
import { isSupabaseConfigured } from '../lib/supabase/config';
import {
  youtubeSearchFiltersToQuery,
  type YoutubeSearchFilters,
} from '../lib/youtubeSearchFilters';

export type YoutubeSearchItemKind = 'video' | 'channel' | 'playlist';

export type YoutubeVideoSummary = {
  kind?: YoutubeSearchItemKind;
  videoId: string;
  channelId?: string;
  playlistId?: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt?: string;
  /** True when from Shorts feed or /shorts/ URL. */
  isShort?: boolean;
  /** True when from Live feed (currently broadcasting). */
  isLive?: boolean;
  /** live | upcoming | none */
  liveBroadcastContent?: 'live' | 'upcoming' | 'none';
  concurrentViewers?: number;
  durationSeconds?: number;
  /** Official YouTube live chat id when the stream is live. */
  activeLiveChatId?: string;
};

export function youtubeResultKey(item: YoutubeVideoSummary): string {
  if (item.kind === 'channel' && item.channelId) return `channel:${item.channelId}`;
  if (item.kind === 'playlist' && item.playlistId) return `playlist:${item.playlistId}`;
  return item.videoId || item.channelId || item.playlistId || item.title;
}

export function isPlayableYoutubeVideo(item: YoutubeVideoSummary): boolean {
  return item.kind !== 'channel' && item.kind !== 'playlist' && /^[a-zA-Z0-9_-]{11}$/.test(item.videoId);
}

export type YoutubeLiveChatKind = 'chat' | 'superChat' | 'superSticker' | 'membership';

export type YoutubeLiveChatMessage = {
  id: string;
  kind: YoutubeLiveChatKind;
  type: string;
  publishedAt: string | null;
  message: string;
  amountDisplayString: string | null;
  amountMicros?: number | null;
  currency: string | null;
  tier: number | null;
  stickerAlt: string | null;
  memberLevelName: string | null;
  author: {
    channelId: string | null;
    displayName: string;
    profileImageUrl: string | null;
    isVerified: boolean;
    isOwner: boolean;
    isModerator: boolean;
    isMember: boolean;
  };
};

export type YoutubeLiveDetails = {
  videoId: string;
  title: string;
  description?: string;
  channelTitle: string;
  channelId: string | null;
  channelThumbnailUrl?: string | null;
  channelDescription?: string | null;
  customUrl?: string | null;
  subscriberCount?: number;
  thumbnailUrl: string;
  isLive: boolean;
  liveBroadcastContent: string;
  concurrentViewers?: number;
  activeLiveChatId: string | null;
  scheduledStartTime: string | null;
  actualStartTime: string | null;
  viewCount?: number;
  likeCount?: number;
  watchUrl: string;
  liveUrl: string;
  channelUrl?: string | null;
};

export type YoutubeLiveChatResponse = {
  messages: YoutubeLiveChatMessage[];
  nextPageToken: string | null;
  pollingIntervalMillis: number;
  offlineAt: string | null;
};

export type YoutubeSearchResponse = {
  items: YoutubeVideoSummary[];
  nextPageToken: string | null;
};

export type YoutubeChapter = { startSeconds: number; label: string };

export type YoutubeVideoDetails = YoutubeVideoSummary & {
  description?: string;
  tags?: string[];
  embeddable?: boolean;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  chapters?: YoutubeChapter[];
};

export type YoutubeComment = {
  id: string;
  author: string;
  authorAvatar: string | null;
  authorChannelId: string | null;
  text: string;
  likeCount: number;
  publishedAt: string | null;
  replyCount?: number;
  replies?: YoutubeComment[];
};

export type YoutubeChannelPage = {
  channel: {
    channelId: string;
    title: string;
    description: string;
    customUrl: string | null;
    thumbnailUrl: string;
    subscriberCount: number;
    videoCount: number;
    viewCount: number;
    uploadsPlaylistId: string | null;
  };
  items: YoutubeVideoSummary[];
  nextPageToken: string | null;
};

export type YoutubeEngagementKind = 'history' | 'favorite' | 'like' | 'watch_later';

/** Persisted in room settings as `youtube:VIDEO_ID`. */
export const WATCH_TOGETHER_YOUTUBE_PREFIX = 'youtube:';

const ENGAGEMENT_CHANGE_EVENT = 'youtube-engagement:change';

function emitEngagementChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ENGAGEMENT_CHANGE_EVENT));
}

export function subscribeYoutubeEngagement(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => listener();
  window.addEventListener(ENGAGEMENT_CHANGE_EVENT, handler);
  return () => window.removeEventListener(ENGAGEMENT_CHANGE_EVENT, handler);
}

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/** Extract a YouTube video id from a URL or `youtube:ID` marker. */
export function parseYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(WATCH_TOGETHER_YOUTUBE_PREFIX)) {
    const id = trimmed.slice(WATCH_TOGETHER_YOUTUBE_PREFIX.length).trim();
    return isValidYoutubeVideoId(id) ? id : null;
  }

  if (isValidYoutubeVideoId(trimmed)) return trimmed;

  try {
    const normalized = trimmed
      .replace(/^<|>$/g, '')
      .replace(/^https?:\/\/(www\.)?/i, 'https://$1')
      .trim();
    const url = new URL(normalized.includes('://') ? normalized : `https://${normalized}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const hostWithWww = url.hostname.toLowerCase();
    if (
      !YOUTUBE_HOSTS.has(hostWithWww) &&
      !YOUTUBE_HOSTS.has(host) &&
      host !== 'youtu.be' &&
      !host.endsWith('youtube.com')
    ) {
      return null;
    }

    if (host === 'youtu.be' || hostWithWww.includes('youtu.be')) {
      const id = url.pathname.replace(/^\//, '').split('/')[0]?.split('?')[0];
      return isValidYoutubeVideoId(id) ? id : null;
    }

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'embed' || parts[0] === 'v' || parts[0] === 'shorts' || parts[0] === 'live') {
      const id = parts[1]?.split('?')[0];
      return isValidYoutubeVideoId(id) ? id : null;
    }

    // youtube.com/watch/VIDEO_ID (rare) or /watch?v=
    if (parts[0] === 'watch' && parts[1] && isValidYoutubeVideoId(parts[1])) {
      return parts[1];
    }

    const fromQuery = url.searchParams.get('v');
    if (isValidYoutubeVideoId(fromQuery)) return fromQuery;

    // Fallbacks: any 11-char id-looking token in path/query
    const haystack = `${url.pathname}?${url.search}`;
    const match = /(?:^|[/=])([a-zA-Z0-9_-]{11})(?:$|[&#?/])/g.exec(haystack);
    return isValidYoutubeVideoId(match?.[1]) ? match![1]! : null;
  } catch {
    return null;
  }
}

export function youtubeThumbnailUrl(videoId: string, quality: 'hqdefault' | 'mqdefault' | 'sddefault' = 'hqdefault'): string {
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}

/** Extract a YouTube playlist id (PL…) from a URL or raw id. */
export function parseYoutubePlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^PL[\w-]{10,}$/i.test(trimmed) || /^UU[\w-]{10,}$/i.test(trimmed) || /^OLAK5uy_[\w-]{10,}$/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    const host = url.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.has(host) && !YOUTUBE_HOSTS.has(host.replace(/^www\./, '')) && !host.endsWith('youtube.com') && !host.includes('youtu.be')) {
      return null;
    }
    if (url.pathname.startsWith('/playlist')) {
      const list = url.searchParams.get('list');
      return list?.trim() || null;
    }
    const list = url.searchParams.get('list');
    return list?.trim() || null;
  } catch {
    return null;
  }
}

export async function fetchYoutubePlaylistItems(
  playlistId: string,
  pageToken?: string,
): Promise<YoutubeSearchResponse> {
  const params = new URLSearchParams({ playlistId: playlistId.trim() });
  if (pageToken) params.set('pageToken', pageToken);
  return apiFetch<YoutubeSearchResponse>(`/api/youtube/playlist?${params.toString()}`);
}

/** Fetch every page of a public YouTube playlist (caps at 1000 items). */
export async function fetchAllYoutubePlaylistItems(
  playlistId: string,
  maxPages = 20,
): Promise<YoutubeVideoSummary[]> {
  const items: YoutubeVideoSummary[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const response = await fetchYoutubePlaylistItems(playlistId, pageToken);
    items.push(...response.items);
    if (!response.nextPageToken) break;
    pageToken = response.nextPageToken;
  }
  return items;
}

export function isValidYoutubeVideoId(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[a-zA-Z0-9_-]{11}$/.test(value);
}

export function isYoutubeMediaRef(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  if (value.startsWith(WATCH_TOGETHER_YOUTUBE_PREFIX)) return true;
  return Boolean(parseYoutubeVideoId(value));
}

export function buildYoutubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

export function buildYoutubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function toWatchTogetherYoutubeRef(videoId: string): string {
  return `${WATCH_TOGETHER_YOUTUBE_PREFIX}${videoId}`;
}

async function apiFetch<T>(
  path: string,
  init?: {
    method?: string;
    body?: unknown;
    accessToken?: string | null;
  },
): Promise<T> {
  const origin =
    typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : '';
  const headers: Record<string, string> = { accept: 'application/json' };
  if (init?.body !== undefined) headers['content-type'] = 'application/json';
  if (init?.accessToken) headers.authorization = `Bearer ${init.accessToken}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let res: Response;
  try {
    res = await fetch(`${origin}${path}`, {
      method: init?.method ?? 'GET',
      headers,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    const aborted =
      (error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof Error && error.name === 'AbortError');
    throw aborted ? new Error('YouTube request timed out') : error;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let message = body || `YouTube API ${res.status}`;
    try {
      const parsed = JSON.parse(body) as { message?: string; error?: string; reason?: string };
      message = parsed.message || parsed.error || message;
      if (parsed.reason) message = `${message} (${parsed.reason})`;
    } catch {
      /* raw */
    }
    const err = new Error(message) as Error & { status?: number; reason?: string };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

export async function searchYoutubeVideos(
  query: string,
  pageToken?: string,
  filters?: YoutubeSearchFilters,
): Promise<YoutubeSearchResponse> {
  const params = youtubeSearchFiltersToQuery({
    ...filters,
    q: query.trim(),
    pageToken,
  });
  const qs = params.toString();
  return apiFetch<YoutubeSearchResponse>(`/api/youtube/search${qs ? `?${qs}` : ''}`);
}

export async function fetchYoutubeVideoDetails(videoId: string): Promise<YoutubeVideoDetails> {
  const params = new URLSearchParams({ videoId: videoId.trim() });
  return apiFetch<YoutubeVideoDetails>(`/api/youtube/video?${params.toString()}`);
}

export async function fetchYoutubeRelated(
  videoId: string,
  pageToken?: string,
): Promise<YoutubeSearchResponse> {
  const params = new URLSearchParams({ videoId: videoId.trim() });
  if (pageToken) params.set('pageToken', pageToken);
  return apiFetch<YoutubeSearchResponse>(`/api/youtube/related?${params.toString()}`);
}

export async function fetchYoutubeComments(
  videoId: string,
  pageToken?: string,
  order: 'relevance' | 'time' = 'relevance',
): Promise<{ items: YoutubeComment[]; nextPageToken: string | null }> {
  const params = new URLSearchParams({ videoId: videoId.trim(), order });
  if (pageToken) params.set('pageToken', pageToken);
  return apiFetch(`/api/youtube/comments?${params.toString()}`);
}

export async function fetchYoutubeCommentReplies(
  parentId: string,
  pageToken?: string,
): Promise<{ items: YoutubeComment[]; nextPageToken: string | null }> {
  const params = new URLSearchParams({ parentId: parentId.trim() });
  if (pageToken) params.set('pageToken', pageToken);
  return apiFetch(`/api/youtube/comments/replies?${params.toString()}`);
}

export async function fetchYoutubeChannelPage(
  channelId: string,
  pageToken?: string,
): Promise<YoutubeChannelPage> {
  const params = new URLSearchParams({ channelId: channelId.trim() });
  if (pageToken) params.set('pageToken', pageToken);
  return apiFetch(`/api/youtube/channel?${params.toString()}`);
}

/** Home feed — videos.list mostPopular (cheap; avoids Search Queries quota). */
export async function fetchYoutubePopular(pageToken?: string): Promise<YoutubeSearchResponse> {
  const params = new URLSearchParams();
  if (pageToken) params.set('pageToken', pageToken);
  const qs = params.toString();
  return apiFetch<YoutubeSearchResponse>(`/api/youtube/popular${qs ? `?${qs}` : ''}`);
}

/** Browse / search YouTube Shorts (≤60s vertical clips). */
export async function searchYoutubeShorts(
  query?: string,
  pageToken?: string,
): Promise<YoutubeSearchResponse> {
  const params = new URLSearchParams();
  const q = query?.trim();
  if (q) params.set('q', q);
  if (pageToken) params.set('pageToken', pageToken);
  const qs = params.toString();
  return apiFetch<YoutubeSearchResponse>(`/api/youtube/shorts${qs ? `?${qs}` : ''}`);
}

/** Browse / search currently live (or upcoming) YouTube streams. */
export async function searchYoutubeLive(
  query?: string,
  pageToken?: string,
  eventType: 'live' | 'upcoming' = 'live',
  ids?: string[],
): Promise<YoutubeSearchResponse> {
  const params = new URLSearchParams({ eventType });
  const q = query?.trim();
  if (q) params.set('q', q);
  if (pageToken) params.set('pageToken', pageToken);
  if (ids?.length) params.set('ids', ids.join(','));
  return apiFetch<YoutubeSearchResponse>(`/api/youtube/live?${params.toString()}`);
}

/** Official live stream metadata including activeLiveChatId. */
export async function fetchYoutubeLiveDetails(videoId: string): Promise<YoutubeLiveDetails> {
  const params = new URLSearchParams({ videoId: videoId.trim() });
  return apiFetch<YoutubeLiveDetails>(`/api/youtube/live/details?${params.toString()}`);
}

/** Poll official YouTube live chat (comments, Super Chat, Super Stickers). */
export async function fetchYoutubeLiveChat(
  liveChatId: string,
  pageToken?: string,
): Promise<YoutubeLiveChatResponse> {
  const params = new URLSearchParams({ liveChatId: liveChatId.trim() });
  if (pageToken) params.set('pageToken', pageToken);
  return apiFetch<YoutubeLiveChatResponse>(`/api/youtube/live/chat?${params.toString()}`);
}

/** Send a text message into official YouTube live chat (requires Google YouTube OAuth). */
export async function sendYoutubeLiveChat(input: {
  liveChatId: string;
  messageText: string;
  accessToken: string;
}): Promise<{ id: string; message: string }> {
  return apiFetch<{ id: string; message: string }>('/api/youtube/live/chat', {
    method: 'POST',
    accessToken: input.accessToken,
    body: {
      liveChatId: input.liveChatId.trim(),
      messageText: input.messageText.trim(),
    },
  });
}

export function buildYoutubeLiveUrl(videoId: string): string {
  return `https://www.youtube.com/live/${videoId}`;
}

export function isYoutubeShortsUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.pathname.toLowerCase().includes('/shorts/');
  } catch {
    return false;
  }
}

export function buildYoutubeShortsUrl(videoId: string): string {
  return `https://www.youtube.com/shorts/${videoId}`;
}

export async function isYoutubeSearchConfigured(): Promise<boolean> {
  try {
    const res = await apiFetch<{ ok?: boolean }>('/api/youtube/health');
    return Boolean(res.ok);
  } catch {
    return false;
  }
}

const LOCAL_ENGAGEMENT_KEY = 'youtube-engagement-v1';

type LocalEngagementStore = Record<YoutubeEngagementKind, YoutubeVideoSummary[]>;

const EMPTY_ENGAGEMENT: LocalEngagementStore = {
  history: [],
  favorite: [],
  like: [],
  watch_later: [],
};

function readLocalEngagement(): LocalEngagementStore {
  try {
    const raw = localStorage.getItem(LOCAL_ENGAGEMENT_KEY);
    if (!raw) return { ...EMPTY_ENGAGEMENT, history: [], favorite: [], like: [], watch_later: [] };
    const parsed = JSON.parse(raw) as Partial<LocalEngagementStore>;
    return {
      history: Array.isArray(parsed.history) ? parsed.history : [],
      favorite: Array.isArray(parsed.favorite) ? parsed.favorite : [],
      like: Array.isArray(parsed.like) ? parsed.like : [],
      watch_later: Array.isArray(parsed.watch_later) ? parsed.watch_later : [],
    };
  } catch {
    return { history: [], favorite: [], like: [], watch_later: [] };
  }
}

function writeLocalEngagement(store: LocalEngagementStore): void {
  localStorage.setItem(LOCAL_ENGAGEMENT_KEY, JSON.stringify(store));
  emitEngagementChange();
}

function upsertLocalItem(kind: YoutubeEngagementKind, video: YoutubeVideoSummary): void {
  const store = readLocalEngagement();
  const list = store[kind].filter((entry) => entry.videoId !== video.videoId);
  store[kind] = [video, ...list].slice(0, 100);
  writeLocalEngagement(store);
}

function removeLocalItem(kind: YoutubeEngagementKind, videoId: string): void {
  const store = readLocalEngagement();
  store[kind] = store[kind].filter((entry) => entry.videoId !== videoId);
  writeLocalEngagement(store);
}

async function getAuthUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function upsertCloudEngagement(
  kind: YoutubeEngagementKind,
  video: YoutubeVideoSummary,
): Promise<void> {
  const userId = await getAuthUserId();
  if (!userId) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    await supabase.from('youtube_engagement').upsert(
      {
        user_id: userId,
        video_id: video.videoId,
        title: video.title,
        channel_title: video.channelTitle,
        thumbnail_url: video.thumbnailUrl,
        kind,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,video_id,kind' },
    );
  } catch {
    /* schema may lag */
  }
}

async function deleteCloudEngagement(kind: YoutubeEngagementKind, videoId: string): Promise<void> {
  const userId = await getAuthUserId();
  if (!userId) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    await supabase
      .from('youtube_engagement')
      .delete()
      .eq('user_id', userId)
      .eq('video_id', videoId)
      .eq('kind', kind);
  } catch {
    /* schema may lag */
  }
}

export async function recordYoutubeHistory(video: YoutubeVideoSummary): Promise<void> {
  upsertLocalItem('history', video);
  await upsertCloudEngagement('history', video);
}

async function toggleEngagementKind(
  kind: 'favorite' | 'like' | 'watch_later',
  video: YoutubeVideoSummary,
): Promise<boolean> {
  const store = readLocalEngagement();
  const exists = store[kind].some((entry) => entry.videoId === video.videoId);
  if (exists) {
    removeLocalItem(kind, video.videoId);
    await deleteCloudEngagement(kind, video.videoId);
  } else {
    upsertLocalItem(kind, video);
    await upsertCloudEngagement(kind, video);
  }
  return !exists;
}

export async function toggleYoutubeFavorite(video: YoutubeVideoSummary): Promise<boolean> {
  return toggleEngagementKind('favorite', video);
}

export async function toggleYoutubeLike(video: YoutubeVideoSummary): Promise<boolean> {
  return toggleEngagementKind('like', video);
}

export async function toggleYoutubeWatchLater(video: YoutubeVideoSummary): Promise<boolean> {
  return toggleEngagementKind('watch_later', video);
}

export function readYoutubeEngagement(kind: YoutubeEngagementKind): YoutubeVideoSummary[] {
  return readLocalEngagement()[kind];
}

export function isYoutubeFavorite(videoId: string): boolean {
  return readLocalEngagement().favorite.some((entry) => entry.videoId === videoId);
}

export function isYoutubeLiked(videoId: string): boolean {
  return readLocalEngagement().like.some((entry) => entry.videoId === videoId);
}

export function isYoutubeWatchLater(videoId: string): boolean {
  return readLocalEngagement().watch_later.some((entry) => entry.videoId === videoId);
}

export async function clearYoutubeHistory(): Promise<void> {
  const store = readLocalEngagement();
  store.history = [];
  writeLocalEngagement(store);
  const userId = await getAuthUserId();
  const supabase = getSupabaseClient();
  if (!userId || !supabase) return;
  try {
    await supabase.from('youtube_engagement').delete().eq('user_id', userId).eq('kind', 'history');
  } catch {
    /* ignore */
  }
}

/** Pull cloud engagement into localStorage (merge by videoId, cloud first). */
export async function hydrateYoutubeEngagementFromCloud(): Promise<void> {
  const userId = await getAuthUserId();
  const supabase = getSupabaseClient();
  if (!userId || !supabase) return;

  try {
    const { data, error } = await supabase
      .from('youtube_engagement')
      .select('video_id, title, channel_title, thumbnail_url, kind, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(400);
    if (error || !data?.length) return;

    const store = readLocalEngagement();
    const kinds: YoutubeEngagementKind[] = ['history', 'favorite', 'like', 'watch_later'];
    for (const kind of kinds) {
      const cloudItems = data
        .filter((row) => row.kind === kind)
        .map((row) => ({
          videoId: row.video_id as string,
          title: (row.title as string) || 'YouTube',
          channelTitle: (row.channel_title as string) || '',
          thumbnailUrl: (row.thumbnail_url as string) || '',
        }));
      const byId = new Map<string, YoutubeVideoSummary>();
      for (const item of cloudItems) byId.set(item.videoId, item);
      for (const item of store[kind]) {
        if (!byId.has(item.videoId)) byId.set(item.videoId, item);
      }
      store[kind] = Array.from(byId.values()).slice(0, 100);
    }
    writeLocalEngagement(store);
  } catch {
    /* schema may lag */
  }
}
