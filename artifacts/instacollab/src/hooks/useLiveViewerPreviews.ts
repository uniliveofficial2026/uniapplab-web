import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchStreamViewers, isPlatformApiAvailable } from '../lib/platformApi';
import {
  isPartyRoomPresenceCloudAvailable,
  watchPartyRoomPresence,
  type PartyRoomPresencePayload,
} from '../lib/supabase/partyRoomPresence';
import { safeAvatarUrl } from '../lib/safe';

export type LiveViewerAvatar = {
  id: string;
  avatarUrl: string;
};

export type LiveViewerPreview = {
  count: number;
  avatars: LiveViewerAvatar[];
  caption: 'Live' | 'Room';
};

export type LiveViewerPreviewTarget = {
  key: string;
  streamId?: string;
  partyRoomId?: string;
  initialCount?: number;
};

const STREAM_POLL_MS = 30_000;
const MAX_AVATARS = 3;

function newestAvatars(members: PartyRoomPresencePayload[]): LiveViewerAvatar[] {
  return members.slice(0, MAX_AVATARS).map((member) => ({
    id: member.user_id,
    avatarUrl: safeAvatarUrl(member.avatar_url),
  }));
}

function emptyPreview(
  caption: 'Live' | 'Room',
  count = 0,
): LiveViewerPreview {
  return { count: Math.max(0, count), avatars: [], caption };
}

/**
 * Real-time viewer previews for live discovery cards:
 * - Party rooms: presence members (newest first, up to 3 avatars) + count, caption "Room"
 * - Platform streams: polled viewer count, caption "Live"
 */
export function useLiveViewerPreviews(
  targets: LiveViewerPreviewTarget[],
  enabled = true,
): Record<string, LiveViewerPreview> {
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

  const [previews, setPreviews] = useState<Record<string, LiveViewerPreview>>({});

  useEffect(() => {
    const list = targetsRef.current;
    const seed: Record<string, LiveViewerPreview> = {};
    for (const t of list) {
      seed[t.key] = emptyPreview(
        t.partyRoomId ? 'Room' : 'Live',
        t.initialCount ?? 0,
      );
    }
    setPreviews(seed);

    if (!enabled || list.length === 0) return undefined;

    const handles: Array<ReturnType<typeof watchPartyRoomPresence>> = [];
    let cancelled = false;
    let streamTimer: number | null = null;

    const roomKeys = new Map<string, string[]>();
    const streamTargets: LiveViewerPreviewTarget[] = [];

    for (const target of list) {
      if (target.partyRoomId) {
        const keys = roomKeys.get(target.partyRoomId) ?? [];
        keys.push(target.key);
        roomKeys.set(target.partyRoomId, keys);
      } else if (target.streamId) {
        streamTargets.push(target);
      }
    }

    if (isPartyRoomPresenceCloudAvailable()) {
      for (const [roomId, keys] of roomKeys) {
        const handle = watchPartyRoomPresence(roomId, (members) => {
          if (cancelled) return;
          const avatars = newestAvatars(members);
          const count = members.length;
          setPreviews((prev) => {
            const next = { ...prev };
            for (const key of keys) {
              next[key] = { count, avatars, caption: 'Room' };
            }
            return next;
          });
        });
        handles.push(handle);
      }
    }

    const pollStreams = async () => {
      if (!isPlatformApiAvailable() || streamTargets.length === 0) return;
      const updates: Record<string, LiveViewerPreview> = {};
      await Promise.all(
        streamTargets.map(async (target) => {
          if (!target.streamId) return;
          try {
            const data = await fetchStreamViewers(target.streamId);
            updates[target.key] = emptyPreview('Live', data.viewers ?? 0);
          } catch {
            /* keep last */
          }
        }),
      );
      if (!cancelled && Object.keys(updates).length > 0) {
        setPreviews((prev) => ({ ...prev, ...updates }));
      }
    };

    void pollStreams();
    if (streamTargets.length > 0) {
      streamTimer = window.setInterval(() => void pollStreams(), STREAM_POLL_MS);
    }

    return () => {
      cancelled = true;
      if (streamTimer) window.clearInterval(streamTimer);
      for (const handle of handles) {
        handle?.unsubscribe();
      }
    };
  }, [enabled, signature]);

  return previews;
}
