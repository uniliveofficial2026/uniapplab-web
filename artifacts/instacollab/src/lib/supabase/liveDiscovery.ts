import { getSupabaseClient } from './client';
import { isSupabaseConfigured } from './config';
import type { LiveKind } from '../../types';

export type CloudLiveStream = {
  id: string;
  userId: string;
  title: string;
  startedAt: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  liveKind: LiveKind | null;
  viewerLabel: string;
};

export type CloudLiveProfile = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  liveKind: LiveKind | null;
  liveStartedAt: string | null;
};

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop';

function normalizeLiveKind(raw: string | null | undefined): LiveKind | null {
  const k = String(raw || '').trim();
  if (
    k === 'solo' ||
    k === 'audio-room' ||
    k === 'video-multi' ||
    k === 'pk' ||
    k === 'commerce' ||
    k === 'game'
  ) {
    return k;
  }
  return null;
}

/** Active rows from public.streams joined with profiles. */
export async function fetchCloudLiveStreams(limit = 30): Promise<CloudLiveStream[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('streams')
    .select(
      'id, user_id, title, started_at, profiles!streams_user_id_fkey ( display_name, username, avatar_url, live_kind )',
    )
    .eq('status', 'live')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const rawProfile = (row as { profiles?: Record<string, unknown> | Record<string, unknown>[] })
      .profiles;
    const profile = Array.isArray(rawProfile) ? rawProfile[0] ?? {} : rawProfile ?? {};
    const displayName =
      (typeof profile.display_name === 'string' && profile.display_name) ||
      (typeof profile.username === 'string' && profile.username) ||
      'Live';
    const username = (typeof profile.username === 'string' && profile.username) || displayName;
    const avatarUrl =
      (typeof profile.avatar_url === 'string' && profile.avatar_url) || DEFAULT_AVATAR;
    const liveKind = normalizeLiveKind(
      typeof profile.live_kind === 'string' ? profile.live_kind : null,
    );
    return {
      id: String(row.id),
      userId: String(row.user_id),
      title: String(row.title || 'Live'),
      startedAt: String(row.started_at || new Date().toISOString()),
      displayName,
      username,
      avatarUrl,
      liveKind,
      viewerLabel: 'Live',
    };
  });
}

/** Profiles marked live (ring / discovery fallback). */
export async function fetchCloudLiveProfiles(limit = 30): Promise<CloudLiveProfile[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, live_kind, live_started_at')
    .eq('live_status', 'live')
    .order('live_started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    displayName: String(row.display_name || row.username || 'Live'),
    username: String(row.username || row.display_name || 'user'),
    avatarUrl: (row.avatar_url as string | null) ?? DEFAULT_AVATAR,
    liveKind: normalizeLiveKind(row.live_kind as string | null),
    liveStartedAt: (row.live_started_at as string | null) ?? null,
  }));
}

export async function setProfileLivePresence(
  userId: string,
  isLive: boolean,
  liveKind?: LiveKind,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase || !userId) return;

  const patch = isLive
    ? {
        live_status: 'live' as const,
        live_kind: liveKind ?? 'solo',
        live_started_at: new Date().toISOString(),
      }
    : {
        live_status: null,
        live_kind: null,
        live_started_at: null,
      };

  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

export function isLiveDiscoveryCloudAvailable(): boolean {
  return isSupabaseConfigured();
}
