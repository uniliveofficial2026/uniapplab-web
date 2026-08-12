import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchStreamViewers, isPlatformApiAvailable } from '../lib/platformApi';
import { fetchPartyRoomById } from '../lib/supabase/partyRooms';
import { isSupabaseConfigured } from '../lib/supabase/config';
import {
  isPartyRoomPresenceCloudAvailable,
  watchPartyRoomPresence,
} from '../lib/supabase/partyRoomPresence';

export type LiveViewerCountTarget = {
  key: string;
  streamId?: string;
  partyRoomId?: string;
  /** Seed count from discovery until the first poll lands. */
  initialCount?: number;
};

/** HTTP poll is backup only — Realtime presence is primary for party rooms. */
const POLL_MS = 30_000;

/**
 * Real-time viewer / participant counts for live streams and party rooms.
 * Party rooms: Supabase Presence (instant); HTTP poll ≥30s as backup.
 * Streams: platform API poll (backup cadence).
 */
export function useLiveViewerCounts(
  targets: LiveViewerCountTarget[],
  enabled = true,
): Record<string, number> {
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  const signature = useMemo(
    () =>
      targets
        .map(
          (t) =>
            `${t.key}:${t.streamId ?? ''}:${t.partyRoomId ?? ''}:${t.initialCount ?? 0}`,
        )
        .join('|'),
    [targets],
  );

  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const list = targetsRef.current;
    const seed: Record<string, number> = {};
    for (const t of list) {
      seed[t.key] = Math.max(0, t.initialCount ?? 0);
    }
    setCounts(seed);

    if (!enabled || list.length === 0) return undefined;

    let cancelled = false;
    const unsubs: Array<() => void> = [];

    for (const target of list) {
      if (!target.partyRoomId || !isPartyRoomPresenceCloudAvailable()) continue;
      const handle = watchPartyRoomPresence(target.partyRoomId, (members) => {
        if (cancelled) return;
        setCounts((prev) => ({
          ...prev,
          [target.key]: Math.max(0, members.length),
        }));
      });
      if (handle) {
        unsubs.push(() => handle.unsubscribe());
      }
    }

    const poll = async () => {
      const current = targetsRef.current;
      const updates: Record<string, number> = {};
      await Promise.all(
        current.map(async (target) => {
          try {
            if (target.partyRoomId && isSupabaseConfigured()) {
              const room = await fetchPartyRoomById(target.partyRoomId);
              if (room) {
                updates[target.key] = Math.max(0, room.participant_count ?? 0);
                return;
              }
            }
            if (target.streamId && isPlatformApiAvailable()) {
              const data = await fetchStreamViewers(target.streamId);
              updates[target.key] = Math.max(0, data.viewers ?? 0);
            }
          } catch {
            /* keep last known count */
          }
        }),
      );
      if (!cancelled && Object.keys(updates).length > 0) {
        setCounts((prev) => ({ ...prev, ...updates }));
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      for (const unsub of unsubs) unsub();
    };
  }, [enabled, signature]);

  return counts;
}
