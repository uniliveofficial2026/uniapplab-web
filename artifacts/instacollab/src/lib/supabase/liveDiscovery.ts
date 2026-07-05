import { getSupabaseClient } from './client';
import { isSupabaseConfigured } from './config';
import {
  blockLivePresenceCloudQueries,
  isLivePresenceCloudBlocked,
  isMissingLiveColumnError,
  unblockLivePresenceCloudQueries,
} from './livePresenceGuard';
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

function isMissingColumnError(error: { message?: string } | null, column: string): boolean {
  const msg = String(error?.message || '');
  return msg.includes(column) && /does not exist|column/i.test(msg);
}

/** Active rows from public.streams with profile metadata. */
export async function fetchCloudLiveStreams(limit = 30): Promise<CloudLiveStream[]> {
  if (isLivePresenceCloudBlocked()) return [];

  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data: streamRows, error } = await supabase
    .from('streams')
    .select('id, user_id, title, started_at')
    .eq('status', 'live')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  if (!streamRows?.length) return [];

  const userIds = [...new Set(streamRows.map((r) => String(r.user_id)).filter(Boolean))];
  let profileRows: Record<string, unknown>[] | null = null;
  let profileError: { message?: string } | null = null;

  const withLiveKind = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, live_kind')
    .in('id', userIds);

  if (withLiveKind.error && isMissingColumnError(withLiveKind.error, 'live_kind')) {
    blockLivePresenceCloudQueries();
    const fallback = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', userIds);
    profileRows = (fallback.data ?? []) as Record<string, unknown>[];
    profileError = fallback.error;
  } else {
    profileRows = (withLiveKind.data ?? []) as Record<string, unknown>[];
    profileError = withLiveKind.error;
    if (!profileError) unblockLivePresenceCloudQueries();
  }

  if (profileError) throw profileError;

  const profileById = new Map(
    (profileRows ?? []).map((p) => [String(p.id), p as Record<string, unknown>]),
  );

  return streamRows.map((row) => {
    const profile = profileById.get(String(row.user_id)) ?? {};
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
  if (isLivePresenceCloudBlocked()) return [];

  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const full = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, live_kind, live_started_at')
    .eq('live_status', 'live')
    .order('live_started_at', { ascending: false })
    .limit(limit);

  let data = full.data;
  let error = full.error;

  if (error && (isMissingColumnError(error, 'live_kind') || isMissingColumnError(error, 'live_status'))) {
    blockLivePresenceCloudQueries();
    return [];
  }

  if (error) throw error;

  unblockLivePresenceCloudQueries();

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
  if (isLivePresenceCloudBlocked()) return;

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
  if (error) {
    if (isMissingLiveColumnError(error)) {
      blockLivePresenceCloudQueries();
      return;
    }
    throw error;
  }
}

export function isLiveDiscoveryCloudAvailable(): boolean {
  return isSupabaseConfigured() && !isLivePresenceCloudBlocked();
}
