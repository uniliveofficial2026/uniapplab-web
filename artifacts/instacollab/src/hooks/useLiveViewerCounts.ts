import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchStreamViewers, isPlatformApiAvailable } from '../lib/platformApi';
import { fetchPartyRoomById } from '../lib/supabase/partyRooms';
import { isSupabaseConfigured } from '../lib/supabase/config';

export type LiveViewerCountTarget = {
  key: string;
  streamId?: string;
  partyRoomId?: string;
  /** Seed count from discovery until the first poll lands. */
  initialCount?: number;
};

const POLL_MS = 10_000;

/**
 * Poll real-time viewer / participant counts for live streams and party rooms.
 * Stream counts come from the platform API; room counts from party_rooms.participant_count.
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
    };
  }, [enabled, signature]);

  return counts;
}
