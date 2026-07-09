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
import { fetchActivePartyRooms } from '../lib/party/partyRoomsCloud';
import { isPartyCloudAvailable } from '../lib/party/partyCloud';
import { fetchProfile } from '../lib/supabase/profile';
import { getSupabaseClient } from '../lib/supabase/client';
import { isSupabaseConfigured } from '../lib/supabase/config';
import { removeSupabaseChannelsContaining } from '../lib/supabase/realtimeChannelUtils';
import {
  formatViewerCount,
  parseViewerCount,
} from '../lib/live/formatViewerCount';
import { isLiveRingRoomMode, liveKindFromRoomMode } from '../lib/liveRing';
import { subscribeLiveCloudSurfaceRefresh } from '../lib/liveCloudSurfaces';
import { scheduleInstant } from '../lib/instantTask';
import { isNetworkOnline } from '../lib/networkStatus';

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
};

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=500&auto=format&fit=crop&q=60';

const POLL_MS = 30_000;

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

function fromCloudStream(row: CloudLiveStream, viewerCount = 0): LiveDiscoveryItem {
  return withViewerCount({
    id: row.id,
    userId: row.userId,
    user: row.displayName,
    title: row.title,
    img: row.avatarUrl || FALLBACK_IMG,
    tags: row.liveKind ? [row.liveKind] : ['Live'],
    streamId: row.id,
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

async function buildDiscoveryItems(): Promise<LiveDiscoveryItem[]> {
  let items: LiveDiscoveryItem[] = [];

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
    } else {
    const [streamRows, profileRows, partyRows] = await Promise.all([
      fetchCloudLiveStreams(30).catch(() => []),
      fetchCloudLiveProfiles(30).catch(() => []),
      fetchActivePartyRooms(30).catch(() => []),
    ]);

    const seenUserIds = new Set(items.map((entry) => entry.userId));
    const seenPartyIds = new Set(
      items.map((entry) => entry.partyRoomId).filter(Boolean) as string[],
    );

    for (const row of streamRows) {
      if (seenUserIds.has(row.userId)) continue;
      seenUserIds.add(row.userId);
      items.push(fromCloudStream(row));
    }

    for (const row of profileRows) {
      if (seenUserIds.has(row.id)) continue;
      seenUserIds.add(row.id);
      items.push(
        withViewerCount({
          id: `profile-live-${row.id}`,
          userId: row.id,
          user: row.displayName,
          title: 'Live',
          img: row.avatarUrl || FALLBACK_IMG,
          tags: row.liveKind ? [row.liveKind] : ['Live'],
          viewerCount: 0,
        }),
      );
    }

    const liveRooms = partyRows.filter(
      (room) => isLiveRingRoomMode(room.room_mode) && !seenPartyIds.has(room.id),
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
      const liveKind = liveKindFromRoomMode(room.room_mode);
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
        }),
      );
    }
    }
  }

  if (!isSupabaseConfigured() && isPartyCloudAvailable()) {
    const partyRows = await fetchActivePartyRooms(30).catch(() => []);
    const seenPartyIds = new Set(
      items.map((entry) => entry.partyRoomId).filter(Boolean) as string[],
    );
    const liveRooms = partyRows.filter(
      (room) => isLiveRingRoomMode(room.room_mode) && !seenPartyIds.has(room.id),
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
      const liveKind = liveKindFromRoomMode(room.room_mode);
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
        }),
      );
    }
  }

  return attachStreamViewerCounts(items);
}

export function useCloudLiveDiscovery(enabled = true) {
  const [streams, setStreams] = useState<LiveDiscoveryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshingRef = useRef(false);
  const refreshRef = useRef<(opts?: { silent?: boolean }) => Promise<void>>(async () => {});

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!enabled) {
      setStreams([]);
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
      const items = await buildDiscoveryItems();
      setStreams(items);
    } catch {
      // Keep previous streams on failure — silent degrade to last good list.
    } finally {
      refreshingRef.current = false;
      setLoading(false);
    }
  }, [enabled]);

  refreshRef.current = refresh;

  useEffect(() => {
    void refreshRef.current();
    const timer = window.setInterval(() => void refreshRef.current({ silent: true }), POLL_MS);
    const unsubSurface = subscribeLiveCloudSurfaceRefresh(['live', 'party', 'all'], () => {
      void refreshRef.current({ silent: true });
    });
    return () => {
      window.clearInterval(timer);
      unsubSurface();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured()) return undefined;
    const supabase = getSupabaseClient();
    if (!supabase) return undefined;

    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    const instanceId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const scheduleRefresh = () => {
      scheduleInstant('live-discovery-refresh', () => {
        void refreshRef.current({ silent: true });
      });
    };

    void (async () => {
      await removeSupabaseChannelsContaining(supabase, 'live-discovery-feed');
      if (cancelled) return;

      channel = supabase
        .channel(`live-discovery-feed:${instanceId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'party_rooms' },
          scheduleRefresh,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
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
  }, [enabled]);

  return { streams, loading, error, refresh };
}
