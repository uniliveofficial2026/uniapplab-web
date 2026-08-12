/**
 * App-owned YouTube playlists — localStorage primary, Supabase when authed.
 */
import { getSupabaseClient } from './supabase/client';
import { isSupabaseConfigured } from './supabase/config';
import type { YoutubeVideoSummary } from '../services/youtube';

export type YoutubePlaylist = {
  id: string;
  title: string;
  description: string;
  items: YoutubeVideoSummary[];
  updatedAt: number;
};

const LOCAL_KEY = 'youtube-playlists-v1';
const CHANGE_EVENT = 'youtube-playlists:change';

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function emitChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function readLocal(): YoutubePlaylist[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as YoutubePlaylist[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && typeof p.id === 'string' && typeof p.title === 'string')
      .map((p) => ({
        id: p.id,
        title: p.title,
        description: typeof p.description === 'string' ? p.description : '',
        items: Array.isArray(p.items) ? p.items : [],
        updatedAt: Number(p.updatedAt) || Date.now(),
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function writeLocal(playlists: YoutubePlaylist[]): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(playlists));
  emitChange();
}

async function getAuthUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export function listYoutubePlaylists(): YoutubePlaylist[] {
  return readLocal();
}

export function getYoutubePlaylist(id: string): YoutubePlaylist | null {
  return readLocal().find((p) => p.id === id) ?? null;
}

export function subscribeYoutubePlaylists(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => listener();
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

export async function createYoutubePlaylist(title: string): Promise<YoutubePlaylist> {
  const trimmed = title.trim() || 'Untitled playlist';
  const playlist: YoutubePlaylist = {
    id: newId(),
    title: trimmed,
    description: '',
    items: [],
    updatedAt: Date.now(),
  };
  writeLocal([playlist, ...readLocal()]);

  const userId = await getAuthUserId();
  const supabase = getSupabaseClient();
  if (userId && supabase) {
    try {
      const { data } = await supabase
        .from('youtube_playlists')
        .insert({ id: playlist.id, user_id: userId, title: trimmed })
        .select('id')
        .single();
      if (data?.id && data.id !== playlist.id) {
        const next = readLocal().map((p) =>
          p.id === playlist.id ? { ...p, id: data.id as string } : p,
        );
        writeLocal(next);
        playlist.id = data.id as string;
      }
    } catch {
      /* local-first */
    }
  }
  return playlist;
}

export async function renameYoutubePlaylist(id: string, title: string): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) return;
  writeLocal(
    readLocal().map((p) =>
      p.id === id ? { ...p, title: trimmed, updatedAt: Date.now() } : p,
    ),
  );
  const userId = await getAuthUserId();
  const supabase = getSupabaseClient();
  if (userId && supabase) {
    try {
      await supabase
        .from('youtube_playlists')
        .update({ title: trimmed, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);
    } catch {
      /* local-first */
    }
  }
}

export async function deleteYoutubePlaylist(id: string): Promise<void> {
  writeLocal(readLocal().filter((p) => p.id !== id));
  const userId = await getAuthUserId();
  const supabase = getSupabaseClient();
  if (userId && supabase) {
    try {
      await supabase.from('youtube_playlists').delete().eq('id', id).eq('user_id', userId);
    } catch {
      /* local-first */
    }
  }
}

export async function addVideoToYoutubePlaylist(
  playlistId: string,
  video: YoutubeVideoSummary,
): Promise<boolean> {
  const playlists = readLocal();
  const target = playlists.find((p) => p.id === playlistId);
  if (!target) return false;
  if (target.items.some((item) => item.videoId === video.videoId)) return true;
  const nextItems = [...target.items, video];
  writeLocal(
    playlists.map((p) =>
      p.id === playlistId ? { ...p, items: nextItems, updatedAt: Date.now() } : p,
    ),
  );

  const userId = await getAuthUserId();
  const supabase = getSupabaseClient();
  if (userId && supabase) {
    try {
      await supabase.from('youtube_playlist_items').upsert(
        {
          playlist_id: playlistId,
          user_id: userId,
          video_id: video.videoId,
          title: video.title,
          channel_title: video.channelTitle,
          thumbnail_url: video.thumbnailUrl,
          position: nextItems.length - 1,
        },
        { onConflict: 'playlist_id,video_id' },
      );
      await supabase
        .from('youtube_playlists')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', playlistId)
        .eq('user_id', userId);
    } catch {
      /* local-first */
    }
  }
  return true;
}

export async function removeVideoFromYoutubePlaylist(
  playlistId: string,
  videoId: string,
): Promise<void> {
  writeLocal(
    readLocal().map((p) =>
      p.id === playlistId
        ? {
            ...p,
            items: p.items.filter((item) => item.videoId !== videoId),
            updatedAt: Date.now(),
          }
        : p,
    ),
  );
  const userId = await getAuthUserId();
  const supabase = getSupabaseClient();
  if (userId && supabase) {
    try {
      await supabase
        .from('youtube_playlist_items')
        .delete()
        .eq('playlist_id', playlistId)
        .eq('video_id', videoId)
        .eq('user_id', userId);
    } catch {
      /* local-first */
    }
  }
}

/** Merge cloud playlists into local (cloud wins on conflict by updatedAt). */
export async function hydrateYoutubePlaylistsFromCloud(): Promise<void> {
  const userId = await getAuthUserId();
  const supabase = getSupabaseClient();
  if (!userId || !supabase) return;

  try {
    const { data: rows, error } = await supabase
      .from('youtube_playlists')
      .select('id, title, description, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error || !rows?.length) return;

    const { data: items } = await supabase
      .from('youtube_playlist_items')
      .select('playlist_id, video_id, title, channel_title, thumbnail_url, position')
      .eq('user_id', userId)
      .order('position', { ascending: true });

    const itemsByPlaylist = new Map<string, YoutubeVideoSummary[]>();
    for (const row of items ?? []) {
      const list = itemsByPlaylist.get(row.playlist_id) ?? [];
      list.push({
        videoId: row.video_id,
        title: row.title || 'YouTube',
        channelTitle: row.channel_title || '',
        thumbnailUrl: row.thumbnail_url || '',
      });
      itemsByPlaylist.set(row.playlist_id, list);
    }

    const cloud: YoutubePlaylist[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description || '',
      items: itemsByPlaylist.get(row.id) ?? [],
      updatedAt: new Date(row.updated_at).getTime(),
    }));

    const local = readLocal();
    const byId = new Map<string, YoutubePlaylist>();
    for (const p of local) byId.set(p.id, p);
    for (const p of cloud) {
      const existing = byId.get(p.id);
      if (!existing || p.updatedAt >= existing.updatedAt) byId.set(p.id, p);
    }
    writeLocal(Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt));
  } catch {
    /* tables may not exist yet */
  }
}
