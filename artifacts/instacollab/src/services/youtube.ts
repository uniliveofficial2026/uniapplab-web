import { getSupabaseClient } from '../lib/supabase/client';
import { isSupabaseConfigured } from '../lib/supabase/config';

export type YoutubeVideoSummary = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt?: string;
};

export type YoutubeSearchResponse = {
  items: YoutubeVideoSummary[];
  nextPageToken: string | null;
};

export type YoutubeEngagementKind = 'history' | 'favorite' | 'like';

/** Persisted in room settings as `youtube:VIDEO_ID`. */
export const WATCH_TOGETHER_YOUTUBE_PREFIX = 'youtube:';

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
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
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.has(host)) return null;

    if (host.includes('youtu.be')) {
      const id = url.pathname.replace(/^\//, '').split('/')[0];
      return isValidYoutubeVideoId(id) ? id : null;
    }

    if (url.pathname.startsWith('/embed/')) {
      const id = url.pathname.split('/')[2];
      return isValidYoutubeVideoId(id) ? id : null;
    }

    if (url.pathname.startsWith('/shorts/')) {
      const id = url.pathname.split('/')[2];
      return isValidYoutubeVideoId(id) ? id : null;
    }

    const fromQuery = url.searchParams.get('v');
    return isValidYoutubeVideoId(fromQuery) ? fromQuery : null;
  } catch {
    return null;
  }
}

/** Extract a YouTube playlist id (PL…) from a URL or raw id. */
export function parseYoutubePlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^PL[\w-]{10,}$/i.test(trimmed) || /^UU[\w-]{10,}$/i.test(trimmed) || /^OLAK5uy_[\w-]{10,}$/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.has(host)) return null;
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

export function isValidYoutubeVideoId(value: string | null | undefined): value is string {
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

async function apiFetch<T>(path: string): Promise<T> {
  const origin =
    typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : '';
  const res = await fetch(`${origin}${path}`, {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `YouTube API ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function searchYoutubeVideos(
  query: string,
  pageToken?: string,
): Promise<YoutubeSearchResponse> {
  const params = new URLSearchParams({ q: query.trim() });
  if (pageToken) params.set('pageToken', pageToken);
  return apiFetch<YoutubeSearchResponse>(`/api/youtube/search?${params.toString()}`);
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

type LocalEngagementStore = Record<
  YoutubeEngagementKind,
  YoutubeVideoSummary[]
>;

function readLocalEngagement(): LocalEngagementStore {
  try {
    const raw = localStorage.getItem(LOCAL_ENGAGEMENT_KEY);
    if (!raw) return { history: [], favorite: [], like: [] };
    const parsed = JSON.parse(raw) as Partial<LocalEngagementStore>;
    return {
      history: Array.isArray(parsed.history) ? parsed.history : [],
      favorite: Array.isArray(parsed.favorite) ? parsed.favorite : [],
      like: Array.isArray(parsed.like) ? parsed.like : [],
    };
  } catch {
    return { history: [], favorite: [], like: [] };
  }
}

function writeLocalEngagement(store: LocalEngagementStore): void {
  localStorage.setItem(LOCAL_ENGAGEMENT_KEY, JSON.stringify(store));
}

function upsertLocalItem(kind: YoutubeEngagementKind, video: YoutubeVideoSummary): void {
  const store = readLocalEngagement();
  const list = store[kind].filter((entry) => entry.videoId !== video.videoId);
  store[kind] = [video, ...list].slice(0, 50);
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

export async function recordYoutubeHistory(video: YoutubeVideoSummary): Promise<void> {
  upsertLocalItem('history', video);
  const userId = await getAuthUserId();
  if (!userId) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.from('youtube_engagement').upsert(
    {
      user_id: userId,
      video_id: video.videoId,
      title: video.title,
      channel_title: video.channelTitle,
      thumbnail_url: video.thumbnailUrl,
      kind: 'history',
    },
    { onConflict: 'user_id,video_id,kind' },
  );
}

export async function toggleYoutubeFavorite(video: YoutubeVideoSummary): Promise<boolean> {
  const store = readLocalEngagement();
  const exists = store.favorite.some((entry) => entry.videoId === video.videoId);
  if (exists) {
    removeLocalItem('favorite', video.videoId);
  } else {
    upsertLocalItem('favorite', video);
  }

  const userId = await getAuthUserId();
  if (userId) {
    const supabase = getSupabaseClient();
    if (supabase) {
      if (exists) {
        await supabase
          .from('youtube_engagement')
          .delete()
          .eq('user_id', userId)
          .eq('video_id', video.videoId)
          .eq('kind', 'favorite');
      } else {
        await supabase.from('youtube_engagement').upsert(
          {
            user_id: userId,
            video_id: video.videoId,
            title: video.title,
            channel_title: video.channelTitle,
            thumbnail_url: video.thumbnailUrl,
            kind: 'favorite',
          },
          { onConflict: 'user_id,video_id,kind' },
        );
      }
    }
  }
  return !exists;
}

export async function toggleYoutubeLike(video: YoutubeVideoSummary): Promise<boolean> {
  const store = readLocalEngagement();
  const exists = store.like.some((entry) => entry.videoId === video.videoId);
  if (exists) {
    removeLocalItem('like', video.videoId);
  } else {
    upsertLocalItem('like', video);
  }

  const userId = await getAuthUserId();
  if (userId) {
    const supabase = getSupabaseClient();
    if (supabase) {
      if (exists) {
        await supabase
          .from('youtube_engagement')
          .delete()
          .eq('user_id', userId)
          .eq('video_id', video.videoId)
          .eq('kind', 'like');
      } else {
        await supabase.from('youtube_engagement').upsert(
          {
            user_id: userId,
            video_id: video.videoId,
            title: video.title,
            channel_title: video.channelTitle,
            thumbnail_url: video.thumbnailUrl,
            kind: 'like',
          },
          { onConflict: 'user_id,video_id,kind' },
        );
      }
    }
  }
  return !exists;
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
