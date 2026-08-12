import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { fetchProfile } from '../lib/supabase/profile';
import { getFirebaseFirestore } from '../lib/firebase/app';
import { isFirebaseConfigured } from '../lib/firebase/config';
import { isPartyCloudAvailable, shouldUseFirebaseForPartyCloud } from '../lib/party/partyCloud';
import { fetchActivePartyRooms, type PartyRoomRow } from '../lib/party/partyRoomsCloud';
import { getSupabaseClient } from '../lib/supabase/client';
import { isSupabaseConfigured } from '../lib/supabase/config';
import { subscribeLiveCloudSurfaceRefresh } from '../lib/liveCloudSurfaces';
import { normalizeStorageRoomMode } from '../lib/liveRing';
import { normalizeRoomPrivacy, type RoomPrivacy } from '../smule-rooms/utils/roomPrivacy';
import { scheduleInstant } from '../lib/instantTask';
import { isNetworkOnline } from '../lib/networkStatus';
import { useKeepAliveTabActive } from '../lib/keepAliveTabContext';

export type CloudPartyLobbyRoom = {
  id: string;
  name: string;
  host: string;
  hostUserId: string;
  participants: number;
  max: number;
  tags: string[];
  roomMode: string;
  privacy: RoomPrivacy;
  coverUrl: string | null;
  updatedAt?: string;
};

async function rowToLobby(room: PartyRoomRow): Promise<CloudPartyLobbyRoom> {
  let host = 'Host';
  try {
    const profile = await fetchProfile(room.owner_id);
    if (profile?.display_name) host = profile.display_name;
    else if (profile?.username) host = profile.username;
  } catch {
    /* ignore */
  }
  return {
    id: room.id,
    name: room.room_name,
    host,
    hostUserId: room.owner_id,
    participants: Math.max(0, room.participant_count ?? 0),
    max: room.max_participants ?? 50,
    tags: Array.isArray(room.tags) ? room.tags : [],
    roomMode: normalizeStorageRoomMode(room.room_mode),
    privacy: normalizeRoomPrivacy(room.privacy),
    coverUrl: room.cover_url,
    updatedAt: room.updated_at,
  };
}

export function useCloudPartyRooms(enabled = true, viewerUserId?: string | null) {
  const tabActive = useKeepAliveTabActive();
  const active = enabled && tabActive;
  const [rooms, setRooms] = useState<CloudPartyLobbyRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshingRef = useRef(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const useFirebase =
    isFirebaseConfigured() && (!isSupabaseConfigured() || shouldUseFirebaseForPartyCloud());

  const refresh = useCallback(async () => {
    if (!active || !isPartyCloudAvailable()) {
      if (!enabled) setRooms([]);
      return;
    }
    if (!isNetworkOnline()) {
      setLoading(false);
      setError(null);
      return;
    }
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setLoading(false);
    setError(null);
    try {
      const rows = await fetchActivePartyRooms(40, viewerUserId ?? undefined);
      const mapped = await Promise.all(rows.map((r) => rowToLobby(r)));
      setRooms(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      refreshingRef.current = false;
      setLoading(false);
    }
  }, [active, enabled, viewerUserId]);

  refreshRef.current = refresh;

  useEffect(() => {
    if (!active) return undefined;
    void refreshRef.current();
    const unsubSurface = subscribeLiveCloudSurfaceRefresh(['party', 'live', 'all'], () => {
      if (document.visibilityState !== 'visible') return;
      scheduleInstant('party-rooms-refresh', () => {
        void refreshRef.current();
      });
    });
    return () => {
      unsubSurface();
    };
  }, [active, viewerUserId]);

  useEffect(() => {
    if (!active || !isPartyCloudAvailable()) return undefined;

    if (useFirebase) {
      const db = getFirebaseFirestore();
      if (!db) return undefined;
      const q = query(
        collection(db, 'party_rooms'),
        where('status', '==', 'active'),
        orderBy('updated_at', 'desc'),
      );
      return onSnapshot(q, () => {
        if (document.visibilityState !== 'visible') return;
        scheduleInstant('party-rooms-firebase', () => {
          void refreshRef.current();
        });
      });
    }

    if (!isSupabaseConfigured()) return undefined;
    const supabase = getSupabaseClient();
    if (!supabase) return undefined;

    const instanceId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    let channel: RealtimeChannel | null = supabase
      .channel(`party-rooms-lobby:${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'party_rooms' },
        () => {
          if (document.visibilityState !== 'visible') return;
          scheduleInstant('party-rooms-realtime', () => {
            void refreshRef.current();
          });
        },
      )
      .subscribe();

    return () => {
      if (channel) void supabase.removeChannel(channel);
      channel = null;
    };
  }, [active, useFirebase]);

  return { rooms, loading, error, refresh };
}
