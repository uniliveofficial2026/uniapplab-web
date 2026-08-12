import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../../lib/db/localDb';
import { fetchActivePartyRooms } from '../../lib/party/partyRoomsCloud';
import { isPartyCloudAvailable } from '../../lib/party/partyCloud';
import { fetchLiveStreams, isPlatformApiAvailable } from '../../lib/platformApi';
import { fetchProfile } from '../../lib/supabase/profile';
import { fetchCloudLiveStreams } from '../../lib/supabase/liveDiscovery';
import {
  fetchFollowerIds,
  fetchFollowingIds,
  isFollowsCloudAvailable,
} from '../../lib/supabase/follows';
import { roomModeFromLiveKind } from '../../lib/liveRing';
import { safeAvatarUrl } from '../../lib/safe';
import { isPkEligibleRoomMode } from '../utils/pkBattleLayout';

const FALLBACK_AVATAR =
  'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=120&h=120&fit=crop&crop=faces';

export type PkLiveHost = {
  userId: string;
  name: string;
  username: string;
  publicUserId: string;
  avatar: string;
  roomId: string;
  roomTitle: string;
  roomMode: string;
  isFollowing: boolean;
  isFollower: boolean;
};

type UsePkLiveHostsOptions = {
  enabled?: boolean;
  selfUserId: string;
  selfRoomId: string;
  pollMs?: number;
  /** Force a refresh when the invite sheet opens. */
  refreshKey?: number;
};

export function pickRandomPkLiveHost(
  hosts: PkLiveHost[],
  selfUserId: string,
): PkLiveHost | null {
  const candidates = hosts.filter((host) => host.userId !== selfUserId);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

async function resolveFollowSets(selfUserId: string): Promise<{
  following: Set<string>;
  followers: Set<string>;
}> {
  const following = new Set<string>();
  const followers = new Set<string>();

  if (isFollowsCloudAvailable()) {
    try {
      for (const id of await fetchFollowingIds(selfUserId)) following.add(id);
      for (const id of await fetchFollowerIds(selfUserId)) followers.add(id);
    } catch {
      /* fall back to local graph */
    }
  }

  for (const id of db.getFollowingIds(selfUserId)) following.add(id);
  for (const id of db.getFollowerIds(selfUserId)) followers.add(id);

  return { following, followers };
}

function hostFromProfile(input: {
  userId: string;
  name: string;
  username?: string;
  publicUserId?: string;
  avatar?: string | null;
  roomId: string;
  roomTitle: string;
  roomMode: string;
  isFollowing: boolean;
  isFollower: boolean;
}): PkLiveHost {
  const username = String(input.username || input.name || 'host').trim();
  return {
    userId: input.userId,
    name: input.name,
    username,
    publicUserId: String(input.publicUserId || username || input.userId).trim(),
    avatar: safeAvatarUrl(input.avatar || FALLBACK_AVATAR),
    roomId: input.roomId,
    roomTitle: input.roomTitle,
    roomMode: input.roomMode,
    isFollowing: input.isFollowing,
    isFollower: input.isFollower,
  };
}

async function buildPkLiveHosts(
  selfUserId: string,
  selfRoomId: string,
): Promise<PkLiveHost[]> {
  const byUserId = new Map<string, PkLiveHost>();
  const profileCache = new Map<string, Awaited<ReturnType<typeof fetchProfile>> | null>();
  const { following, followers } = await resolveFollowSets(selfUserId);

  const followFlags = (userId: string) => ({
    isFollowing: following.has(userId) || db.isFollowingUser(userId),
    isFollower: followers.has(userId),
  });

  const readProfile = async (userId: string) => {
    if (profileCache.has(userId)) return profileCache.get(userId) ?? null;
    try {
      const profile = await fetchProfile(userId);
      profileCache.set(userId, profile);
      return profile;
    } catch {
      profileCache.set(userId, null);
      return null;
    }
  };

  const addHost = (candidate: PkLiveHost) => {
    if (!candidate.userId || candidate.userId === selfUserId) return;
    if (candidate.roomId === selfRoomId) return;
    if (!isPkEligibleRoomMode(candidate.roomMode)) return;
    const flags = followFlags(candidate.userId);
    const next = hostFromProfile({ ...candidate, ...flags });
    const existing = byUserId.get(next.userId);
    if (!existing || existing.roomId.startsWith('stream-')) {
      byUserId.set(next.userId, next);
    }
  };

  if (isPartyCloudAvailable()) {
    try {
      const rows = await fetchActivePartyRooms(50);
      for (const room of rows) {
        if (!room.owner_id || room.id === selfRoomId || room.owner_id === selfUserId) continue;
        const roomMode = String(room.room_mode || '').trim();
        if (!isPkEligibleRoomMode(roomMode)) continue;
        const profile = await readProfile(room.owner_id);
        addHost(
          hostFromProfile({
            userId: room.owner_id,
            name:
              profile?.display_name ||
              profile?.username ||
              room.room_name ||
              'Live host',
            username: profile?.username,
            publicUserId: profile?.public_user_id || profile?.username,
            avatar: room.cover_url || profile?.avatar_url,
            roomId: room.id,
            roomTitle: room.room_name || 'Live',
            roomMode,
            ...followFlags(room.owner_id),
          }),
        );
      }
    } catch {
      /* party list optional */
    }
  }

  try {
    const streams = await fetchCloudLiveStreams(40);
    for (const stream of streams) {
      if (!stream.userId || stream.userId === selfUserId) continue;
      const roomMode = roomModeFromLiveKind(stream.liveKind ?? 'solo');
      if (!isPkEligibleRoomMode(roomMode)) continue;
      addHost(
        hostFromProfile({
          userId: stream.userId,
          name: stream.displayName || stream.username || 'Live host',
          username: stream.username,
          publicUserId: stream.username,
          avatar: stream.avatarUrl,
          roomId: `stream-${stream.id}`,
          roomTitle: stream.title || 'Live',
          roomMode,
          ...followFlags(stream.userId),
        }),
      );
    }
  } catch {
    /* cloud streams optional */
  }

  if (isPlatformApiAvailable()) {
    try {
      const res = await fetchLiveStreams();
      const apiRows = Array.isArray(res?.streams) ? res.streams : [];
      for (const raw of apiRows) {
        const row = raw as Record<string, unknown>;
        const userId = String(row.userId ?? row.user_id ?? '');
        const streamId = String(row.id ?? row.streamId ?? '');
        if (!userId || userId === selfUserId) continue;
        const liveKind = String(row.liveKind ?? row.live_kind ?? 'solo');
        const roomMode = roomModeFromLiveKind(
          liveKind as 'solo' | 'commerce' | 'game' | 'audio-room' | 'video-multi' | 'pk' | 'party',
        );
        if (!isPkEligibleRoomMode(roomMode)) continue;
        const profile = await readProfile(userId);
        addHost(
          hostFromProfile({
            userId,
            name: String(
              row.displayName ?? row.title ?? profile?.display_name ?? profile?.username ?? 'Live host',
            ),
            username: profile?.username ?? String(row.username ?? ''),
            publicUserId: profile?.public_user_id || profile?.username,
            avatar: String(row.thumbnail ?? row.avatarUrl ?? profile?.avatar_url ?? ''),
            roomId: streamId ? `api-stream-${streamId}` : `api-user-${userId}`,
            roomTitle: String(row.title ?? 'Live'),
            roomMode,
            ...followFlags(userId),
          }),
        );
      }
    } catch {
      /* api streams optional */
    }
  }

  return [...byUserId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function usePkLiveHosts({
  enabled = true,
  selfUserId,
  selfRoomId,
  pollMs = 30_000,
  refreshKey = 0,
}: UsePkLiveHostsOptions) {
  const [hosts, setHosts] = useState<PkLiveHost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled || inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(!hasLoadedRef.current);
    setError(null);
    try {
      const next = await buildPkLiveHosts(selfUserId, selfRoomId);
      setHosts(next);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load live hosts');
      setHosts([]);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [enabled, selfRoomId, selfUserId]);

  useEffect(() => {
    if (!enabled) {
      setHosts([]);
      setLoading(false);
      hasLoadedRef.current = false;
      return undefined;
    }
    void refresh();
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(id);
  }, [enabled, pollMs, refresh]);

  useEffect(() => {
    if (!enabled || refreshKey <= 0) return;
    void refresh();
  }, [enabled, refresh, refreshKey]);

  return { hosts, loading, error, refresh };
}
