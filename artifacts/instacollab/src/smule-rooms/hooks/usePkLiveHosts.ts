import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../../lib/db/localDb';
import { fetchPkLiveHosts } from '../../lib/platformApi';
import { fetchProfile } from '../../lib/supabase/profile';
import {
  fetchFollowerIds,
  fetchFollowingIds,
  isFollowsCloudAvailable,
} from '../../lib/supabase/follows';
import { safeAvatarUrl } from '../../lib/safe';
import { isPkEligibleRoomMode, canPkMatchRoomModes } from '../utils/pkBattleLayout';
import { logProductionPkRoute } from '../../lib/live/productionOneVsOnePkGate';

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
  isLive: boolean;
  isPkEligible: boolean;
  source: 'live-lifecycle';
  lastUpdated: string;
  supportedPkModes: string[];
};

type UsePkLiveHostsOptions = {
  enabled?: boolean;
  selfUserId: string;
  selfRoomId: string;
  selfRoomMode?: string;
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

function roomModeFromLifecycleType(roomType: string): string {
  if (roomType === 'commerce') return 'Commerce-Live';
  if (roomType === 'solo_video' || roomType === 'solo_audio') return 'Solo-Live';
  return '';
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
  isLive?: boolean;
  isPkEligible?: boolean;
  lastUpdated?: string;
  supportedPkModes?: string[];
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
    isLive: input.isLive !== false,
    isPkEligible: input.isPkEligible !== false,
    source: 'live-lifecycle',
    lastUpdated: input.lastUpdated || '',
    supportedPkModes: input.supportedPkModes?.length
      ? input.supportedPkModes
      : input.roomMode === 'Commerce-Live'
        ? ['pk_1v1', 'live_sell']
        : ['pk_1v1', 'pk_team'],
  };
}

/**
 * PK invite hosts come only from the live-lifecycle service.
 * Discovery streams / production /api/stream/live rows are not challenge targets.
 */
async function buildPkLiveHosts(
  selfUserId: string,
  selfRoomId: string,
  selfRoomMode?: string,
): Promise<PkLiveHost[]> {
  const byUserId = new Map<string, PkLiveHost>();
  const { following, followers } = await resolveFollowSets(selfUserId);
  const followFlags = (userId: string) => ({
    isFollowing: following.has(userId) || db.isFollowingUser(userId),
    isFollower: followers.has(userId),
  });

  const res = await fetchPkLiveHosts();
  const rows = Array.isArray(res?.hosts) ? res.hosts : [];
  for (const row of rows) {
    const userId = String(row.userId || '').trim();
    const roomId = String(row.roomId || '').trim();
    const roomMode = roomModeFromLifecycleType(String(row.roomType || ''));
    if (!userId || !roomId || !roomMode) continue;
    if (userId === selfUserId || roomId === selfRoomId) continue;
    if (row.isLive === false || row.isPkEligible === false) continue;
    if (!isPkEligibleRoomMode(roomMode)) continue;
    if (selfRoomMode && !canPkMatchRoomModes(selfRoomMode, roomMode)) continue;
    let profile: Awaited<ReturnType<typeof fetchProfile>> | null = null;
    try {
      profile = await fetchProfile(userId);
    } catch {
      profile = null;
    }
    const localUser = db.users.find((u) => u.id === userId);
    byUserId.set(
      userId,
      hostFromProfile({
        userId,
        name: profile?.display_name || profile?.username || localUser?.displayName || 'Live host',
        username: profile?.username || localUser?.username,
        publicUserId: profile?.public_user_id || profile?.username || localUser?.username,
        avatar: profile?.avatar_url || localUser?.avatarUrl,
        roomId,
        roomTitle: profile?.display_name || localUser?.displayName || 'Live',
        roomMode,
        ...followFlags(userId),
        isLive: true,
        isPkEligible: true,
        lastUpdated: row.lastUpdated || row.startedAt,
        supportedPkModes: row.supportedPkModes,
      }),
    );
  }

  return [...byUserId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function usePkLiveHosts({
  enabled = true,
  selfUserId,
  selfRoomId,
  selfRoomMode,
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
      const next = await buildPkLiveHosts(selfUserId, selfRoomId, selfRoomMode);
      setHosts(next);
      hasLoadedRef.current = true;
      logProductionPkRoute({
        event: 'pkLiveHosts',
        selfUserId,
        selfRoomId,
        count: next.length,
        hosts: next.map((host) => ({
          userId: host.userId,
          roomId: host.roomId,
          name: host.name,
          source: host.source,
          isLive: host.isLive,
          isPkEligible: host.isPkEligible,
          lastUpdated: host.lastUpdated,
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load live hosts');
      setHosts([]);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [enabled, selfRoomId, selfRoomMode, selfUserId]);

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
