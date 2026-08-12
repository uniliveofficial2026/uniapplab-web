import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  fetchLiveStreams,
  fetchStreamViewers,
  isPlatformApiAvailable,
} from '../lib/platformApi';
import {
  fetchCloudLiveProfiles,
  fetchCloudLiveStreams,
  isLiveDiscoveryCloudAvailable,
  type CloudLiveStream,
} from '../lib/supabase/liveDiscovery';
import { fetchActivePartyRooms, fetchOwnerActivePartyRoom } from '../lib/party/partyRoomsCloud';
import { isPartyCloudAvailable } from '../lib/party/partyCloud';
import { fetchProfile } from '../lib/supabase/profile';
import { getSupabaseClient } from '../lib/supabase/client';
import { isSupabaseConfigured } from '../lib/supabase/config';
import { removeSupabaseChannelsContaining } from '../lib/supabase/realtimeChannelUtils';
import {
  formatViewerCount,
  parseViewerCount,
} from '../lib/live/formatViewerCount';
import { isDiscoverableLiveRoomMode, discoveryLiveKindFromTags } from '../lib/liveRing';
import { normalizeRoomPrivacy, type RoomPrivacy } from '../smule-rooms/utils/roomPrivacy';
import { subscribeLiveCloudSurfaceRefresh } from '../lib/liveCloudSurfaces';
import { scheduleInstant } from '../lib/instantTask';
import { isNetworkOnline } from '../lib/networkStatus';
import { useKeepAliveTabActive } from '../lib/keepAliveTabContext';

export type LiveDiscoveryItem = {
  id: string;
  userId: string;
  user: string;
  title: string;
  /** Formatted count for display (e.g. "12", "1.2K"). */
  viewers: string;
  /** Numeric viewer / participant count. */
  viewerCount: number;
  img: string;
  tags: string[];
  streamId?: string;
  partyRoomId?: string;
  privacy?: RoomPrivacy;
};

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=500&auto=format&fit=crop&q=60';

const POLL_MS = 20_000;

function withViewerCount(
  item: Omit<LiveDiscoveryItem, 'viewers' | 'viewerCount'> & {
    viewerCount?: number;
  },
): LiveDiscoveryItem {
  const viewerCount = Math.max(0, item.viewerCount ?? 0);
  return {
    ...item,
    viewerCount,
    viewers: formatViewerCount(viewerCount),
  };
}

function fromCloudStream(
  row: CloudLiveStream,
  viewerCount = 0,
  partyRoomId?: string,
): LiveDiscoveryItem {
  // Never seed discovery with bare `pk` from a stale profile live_kind.
  const kindTag =
    row.liveKind && row.liveKind !== 'pk' ? row.liveKind : row.liveKind === 'pk' ? 'solo' : null;
  return withViewerCount({
    id: row.id,
    userId: row.userId,
    user: row.displayName,
    title: row.title,
    img: row.avatarUrl || FALLBACK_IMG,
    tags: kindTag ? [kindTag] : ['Live'],
    streamId: row.id,
    partyRoomId,
    viewerCount,
  });
}

async function attachStreamViewerCounts(
  items: LiveDiscoveryItem[],
): Promise<LiveDiscoveryItem[]> {
  if (!isPlatformApiAvailable()) return items;
  // Cap concurrent viewer polls — full-grid polling made Live feel heavy.
  let polled = 0;
  return Promise.all(
    items.map(async (item) => {
      if (!item.streamId || item.partyRoomId || polled >= 4) return item;
      polled += 1;
      try {
        const data = await fetchStreamViewers(item.streamId);
        return withViewerCount({ ...item, viewerCount: data.viewers ?? 0 });
      } catch {
        return item;
      }
    }),
  );
}

function partyRoomIdByOwner(
  rows: Awaited<ReturnType<typeof fetchActivePartyRooms>>,
  _viewerUserId?: string | null,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const room of rows) {
    if (!room.owner_id || !room.id || map.has(room.owner_id)) continue;
    if (room.status === 'ended') continue;
    map.set(room.owner_id, room.id);
  }
  return map;
}

async function attachPartyRoomIds(
  items: LiveDiscoveryItem[],
  viewerUserId?: string | null,
  partyRows?: Awaited<ReturnType<typeof fetchActivePartyRooms>>,
): Promise<LiveDiscoveryItem[]> {
  // Prefer already-fetched party rows — avoid N+1 owner lookups every poll.
  if (partyRows && partyRows.length > 0) {
    const byOwner = partyRoomIdByOwner(partyRows, viewerUserId);
    const privacyById = new Map(
      partyRows.map((room) => [room.id, normalizeRoomPrivacy(room.privacy)] as const),
    );
    items = items.map((item) => {
      const id = item.partyRoomId || byOwner.get(item.userId);
      if (!id) {
        return item.privacy ? item : { ...item, privacy: 'Public' as RoomPrivacy };
      }
      return {
        ...item,
        partyRoomId: item.partyRoomId || id,
        privacy: item.privacy ?? privacyById.get(id) ?? 'Public',
      };
    });
  }

  const needsResolve = items.filter((item) => !item.partyRoomId || !item.privacy);
  if (needsResolve.length === 0) return items;

  // Cap residual lookups so a large API stream list cannot stall the UI.
  const unresolvedOwners = [...new Set(needsResolve.map((item) => item.userId))].slice(0, 8);
  const resolved = new Map<string, { id: string; privacy: RoomPrivacy }>();
  await Promise.all(
    unresolvedOwners.map(async (userId) => {
      try {
        const room = await fetchOwnerActivePartyRoom(userId);
        if (!room?.id) return;
        resolved.set(userId, {
          id: room.id,
          privacy: normalizeRoomPrivacy(room.privacy),
        });
      } catch {
        /* keep card without partyRoomId */
      }
    }),
  );

  if (resolved.size === 0) {
    return items.map((item) =>
      item.privacy ? item : { ...item, privacy: normalizeRoomPrivacy(item.privacy) },
    );
  }
  return items.map((item) => {
    const hit = resolved.get(item.userId);
    if (!hit?.id) {
      return item.privacy ? item : { ...item, privacy: 'Public' };
    }
    return {
      ...item,
      partyRoomId: item.partyRoomId || hit.id,
      privacy: item.privacy ?? hit.privacy,
    };
  });
}

async function buildDiscoveryItems(viewerUserId?: string | null): Promise<LiveDiscoveryItem[]> {
  let items: LiveDiscoveryItem[] = [];
  let partyRows: Awaited<ReturnType<typeof fetchActivePartyRooms>> = [];


  if (isPlatformApiAvailable()) {
    try {
      const res = await fetchLiveStreams();
      const apiRows = Array.isArray(res?.streams) ? res.streams : [];
      for (const raw of apiRows) {
        const row = raw as Record<string, unknown>;
        const id = String(row.id ?? row.streamId ?? '');
        const userId = String(row.userId ?? row.user_id ?? '');
        if (!id || !userId) continue;
        items.push(
          withViewerCount({
            id,
            userId,
            user: String(row.displayName ?? row.title ?? 'Live'),
            title: String(row.title ?? 'Live'),
            img: String(row.thumbnail ?? row.avatarUrl ?? FALLBACK_IMG),
            tags: ['Live'],
            streamId: id,
            viewerCount: parseViewerCount(row.viewers),
          }),
        );
      }
    } catch {
      /* fall through to Supabase */
    }
  }

  if (isSupabaseConfigured()) {
    if (!isLiveDiscoveryCloudAvailable()) {
      // Skip live_kind / live_status queries while schema repair is pending.
      // Still attach party rooms so mode + privacy discovery works.
      if (isPartyCloudAvailable()) {
        partyRows = await fetchActivePartyRooms(30, viewerUserId ?? undefined).catch(() => []);
      }
    } else {
    const [streamRows, profileRows, fetchedPartyRows] = await Promise.all([
      fetchCloudLiveStreams(30).catch(() => []),
      fetchCloudLiveProfiles(30).catch(() => []),
      fetchActivePartyRooms(30, viewerUserId ?? undefined).catch(() => []),
    ]);
    partyRows = fetchedPartyRows;

    const ownerPartyRoomId = partyRoomIdByOwner(partyRows, viewerUserId);

    const seenUserIds = new Set(items.map((entry) => entry.userId));
    const seenPartyIds = new Set(
      items.map((entry) => entry.partyRoomId).filter(Boolean) as string[],
    );

    for (const row of streamRows) {
      if (seenUserIds.has(row.userId)) continue;
      seenUserIds.add(row.userId);
      const partyRoomId = ownerPartyRoomId.get(row.userId);
      const privacy = partyRows.find((room) => room.id === partyRoomId)?.privacy;
      items.push({
        ...fromCloudStream(row, 0, partyRoomId),
        privacy: privacy ? normalizeRoomPrivacy(privacy) : undefined,
      });
    }

    for (const row of profileRows) {
      if (seenUserIds.has(row.id)) continue;
      seenUserIds.add(row.id);
      const partyRoomId = ownerPartyRoomId.get(row.id);
      const privacy = partyRows.find((room) => room.id === partyRoomId)?.privacy;
      items.push(
        withViewerCount({
          id: `profile-live-${row.id}`,
          userId: row.id,
          user: row.displayName,
          title: 'Live',
          img: row.avatarUrl || FALLBACK_IMG,
          tags:
            row.liveKind && row.liveKind !== 'pk'
              ? [row.liveKind]
              : row.liveKind === 'pk'
                ? ['solo']
                : ['Live'],
          partyRoomId,
          viewerCount: 0,
          privacy: privacy ? normalizeRoomPrivacy(privacy) : undefined,
        }),
      );
    }

    const liveRooms = partyRows.filter(
      (room) =>
        isDiscoverableLiveRoomMode(room.room_mode) &&
        !seenPartyIds.has(room.id),
    );
    const ownerIds = [...new Set(liveRooms.map((room) => room.owner_id).filter(Boolean))];
    const ownerProfiles = await Promise.all(
      ownerIds.map(async (ownerId) => {
        try {
          const profile = await fetchProfile(ownerId);
          return [ownerId, profile] as const;
        } catch {
          return [ownerId, null] as const;
        }
      }),
    );
    const profileByOwner = new Map(ownerProfiles);

    for (const room of liveRooms) {
      seenPartyIds.add(room.id);
      const profile = profileByOwner.get(room.owner_id);
      const host =
        profile?.display_name || profile?.username || 'Host';
      const hostAvatar = profile?.avatar_url ?? null;
      const participantCount = Math.max(0, room.participant_count ?? 0);
      const liveKind = discoveryLiveKindFromTags(room.tags, room.room_mode);
      items = items.filter(
        (entry) =>
          !(entry.userId === room.owner_id && !entry.partyRoomId && !entry.streamId),
      );
      items.push(
        withViewerCount({
          id: `party-live-${room.id}`,
          userId: room.owner_id,
          user: host,
          title: room.room_name,
          img: room.cover_url || hostAvatar || FALLBACK_IMG,
          tags: [liveKind, room.room_mode, ...(room.tags ?? [])],
          partyRoomId: room.id,
          viewerCount: participantCount,
          privacy: normalizeRoomPrivacy(room.privacy),
        }),
      );
    }
    }

    // Party rooms without live discovery cloud still need lobby cards.
    if (!isLiveDiscoveryCloudAvailable() && partyRows.length > 0) {
      const seenPartyIds = new Set(
        items.map((entry) => entry.partyRoomId).filter(Boolean) as string[],
      );
      const liveRooms = partyRows.filter(
        (room) =>
          isDiscoverableLiveRoomMode(room.room_mode) && !seenPartyIds.has(room.id),
      );
      for (const room of liveRooms) {
        const liveKind = discoveryLiveKindFromTags(room.tags, room.room_mode);
        items.push(
          withViewerCount({
            id: `party-live-${room.id}`,
            userId: room.owner_id,
            user: 'Host',
            title: room.room_name,
            img: room.cover_url || FALLBACK_IMG,
            tags: [liveKind, room.room_mode, ...(room.tags ?? [])],
            partyRoomId: room.id,
            viewerCount: Math.max(0, room.participant_count ?? 0),
            privacy: normalizeRoomPrivacy(room.privacy),
          }),
        );
      }
    }
  }

  if (!isSupabaseConfigured() && isPartyCloudAvailable()) {
    partyRows = await fetchActivePartyRooms(30, viewerUserId ?? undefined).catch(() => []);
    const seenPartyIds = new Set(
      items.map((entry) => entry.partyRoomId).filter(Boolean) as string[],
    );
    const liveRooms = partyRows.filter(
      (room) =>
        isDiscoverableLiveRoomMode(room.room_mode) &&
        !seenPartyIds.has(room.id),
    );
    const ownerIds = [...new Set(liveRooms.map((room) => room.owner_id).filter(Boolean))];
    const ownerProfiles = await Promise.all(
      ownerIds.map(async (ownerId) => {
        try {
          const profile = await fetchProfile(ownerId);
          return [ownerId, profile] as const;
        } catch {
          return [ownerId, null] as const;
        }
      }),
    );
    const profileByOwner = new Map(ownerProfiles);

    for (const room of liveRooms) {
      seenPartyIds.add(room.id);
      const profile = profileByOwner.get(room.owner_id);
      const host = profile?.display_name || profile?.username || 'Host';
      const hostAvatar = profile?.avatar_url ?? null;
      const participantCount = Math.max(0, room.participant_count ?? 0);
      const liveKind = discoveryLiveKindFromTags(room.tags, room.room_mode);
      items = items.filter(
        (entry) =>
          !(entry.userId === room.owner_id && !entry.partyRoomId && !entry.streamId),
      );
      items.push(
        withViewerCount({
          id: `party-live-${room.id}`,
          userId: room.owner_id,
          user: host,
          title: room.room_name,
          img: room.cover_url || hostAvatar || FALLBACK_IMG,
          tags: [liveKind, room.room_mode, ...(room.tags ?? [])],
          partyRoomId: room.id,
          viewerCount: participantCount,
          privacy: normalizeRoomPrivacy(room.privacy),
        }),
      );
    }
  }

  return attachPartyRoomIds(await attachStreamViewerCounts(items), viewerUserId, partyRows);
}

export function useCloudLiveDiscovery(enabled = true, viewerUserId?: string | null) {
  const tabActive = useKeepAliveTabActive();
  const active = enabled && tabActive;
  const [streams, setStreams] = useState<LiveDiscoveryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshingRef = useRef(false);
  const refreshRef = useRef<(opts?: { silent?: boolean }) => Promise<void>>(async () => {});

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!active) {
      if (!enabled) setStreams([]);
      return;
    }
    // Offline: keep last known list — never loader, never clear.
    if (!isNetworkOnline()) {
      setLoading(false);
      setError(null);
      return;
    }
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    // Never toggle loading UI — list updates in place from cache/cloud merge.
    setLoading(false);
    setError(null);
    try {
      const items = await buildDiscoveryItems(viewerUserId);
      setStreams(items);
    } catch {
      // Keep previous streams on failure — silent degrade to last good list.
    } finally {
      refreshingRef.current = false;
      setLoading(false);
    }
  }, [active, enabled, viewerUserId]);

  refreshRef.current = refresh;

  useEffect(() => {
    if (!active) return undefined;
    void refreshRef.current();

    let timer: number | null = null;
    const armPoll = () => {
      if (timer != null) window.clearInterval(timer);
      timer = null;
      if (document.visibilityState !== 'visible' || !isNetworkOnline()) return;
      timer = window.setInterval(() => {
        if (document.visibilityState !== 'visible' || !isNetworkOnline()) return;
        void refreshRef.current({ silent: true });
      }, POLL_MS);
    };

    armPoll();
    const onVisibility = () => armPoll();
    document.addEventListener('visibilitychange', onVisibility);

    const unsubSurface = subscribeLiveCloudSurfaceRefresh(['live', 'party', 'all'], () => {
      if (document.visibilityState !== 'visible') return;
      void refreshRef.current({ silent: true });
    });
    return () => {
      if (timer != null) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      unsubSurface();
    };
  }, [active, viewerUserId]);

  useEffect(() => {
    if (!active || !isSupabaseConfigured()) return undefined;
    const supabase = getSupabaseClient();
    if (!supabase) return undefined;

    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    const instanceId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const scheduleRefresh = () => {
      if (document.visibilityState !== 'visible') return;
      scheduleInstant('live-discovery-refresh', () => {
        void refreshRef.current({ silent: true });
      });
    };

    void (async () => {
      await removeSupabaseChannelsContaining(supabase, 'live-discovery-feed');
      if (cancelled) return;

      // Do not listen to `profiles` — every profile write would refresh discovery.
      channel = supabase
        .channel(`live-discovery-feed:${instanceId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'party_rooms' },
          scheduleRefresh,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'streams' },
          scheduleRefresh,
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
      channel = null;
    };
  }, [active, viewerUserId]);

  return { streams, loading, error, refresh };
}
