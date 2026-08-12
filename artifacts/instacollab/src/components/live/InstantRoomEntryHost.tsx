import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import type { RoomFlowEntry } from '../../smule-rooms/context/RoomFlowContext';
import {
  consumePendingKaraokeRoomOpen,
  peekPendingKaraokeRoomOpen,
  type OpenKaraokeRoomDetail,
} from '../../lib/live/openLiveRoom';
import { clearActiveRoomSession } from '../../smule-rooms/utils/managedRooms';

const KaraokeSmuleRoomFlow = lazy(() =>
  import('../karaoke/KaraokeSmuleRoomFlow').then((m) => ({ default: m.KaraokeSmuleRoomFlow })),
);

type InstantRoomSession = {
  path: string;
  entry: RoomFlowEntry;
  flowKey: number;
  posterUrl?: string | null;
  roomName?: string;
  hostName?: string;
};

function sessionFromDetail(
  detail: OpenKaraokeRoomDetail,
  flowKey: number,
): InstantRoomSession | null {
  const path =
    detail.path?.trim() ||
    (detail.roomId?.trim() ? `/room/${detail.roomId.trim()}` : '');
  if (!path) return null;
  return {
    path,
    entry: detail.entry ?? 'live-discovery',
    flowKey,
    roomName: detail.roomName,
    hostName: detail.hostName,
  };
}

/**
 * App-level room shell — paints a fullscreen stage on the same click turn,
 * then hydrates KaraokeSmuleRoomFlow without waiting for the Karaoke tab chunk.
 */
export function InstantRoomEntryHost() {
  const [session, setSession] = useState<InstantRoomSession | null>(() => {
    const pending = peekPendingKaraokeRoomOpen();
    if (!pending) return null;
    return sessionFromDetail(pending, 1);
  });

  const openFromDetail = useCallback((detail: OpenKaraokeRoomDetail) => {
    const next = sessionFromDetail(detail, Date.now());
    if (!next) return;
    if (detail.asViewer) {
      try {
        localStorage.setItem('currentUserRole', 'user');
      } catch {
        /* ignore */
      }
    }
    setSession(next);
  }, []);

  useEffect(() => {
    const pending = consumePendingKaraokeRoomOpen();
    if (pending) openFromDetail(pending);
    // Warm the heavy room chunk as soon as the host mounts.
    void import('../karaoke/KaraokeSmuleRoomFlow').catch(() => {});

    const onInstantOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenKaraokeRoomDetail>).detail;
      if (!detail) return;
      openFromDetail(detail);
    };
    const onKaraokeOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenKaraokeRoomDetail>).detail;
      if (!detail) return;
      openFromDetail(detail);
    };
    const onRoomsLiveOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenKaraokeRoomDetail & { path?: string }>).detail;
      if (!detail) return;
      openFromDetail(detail);
    };

    const onInstantClose = () => {
      clearActiveRoomSession();
      setSession(null);
    };

    window.addEventListener('instant-room-open', onInstantOpen);
    window.addEventListener('karaoke-room-open', onKaraokeOpen);
    window.addEventListener('rooms-live-open', onRoomsLiveOpen);
    window.addEventListener('instant-room-close', onInstantClose);
    return () => {
      window.removeEventListener('instant-room-open', onInstantOpen);
      window.removeEventListener('karaoke-room-open', onKaraokeOpen);
      window.removeEventListener('rooms-live-open', onRoomsLiveOpen);
      window.removeEventListener('instant-room-close', onInstantClose);
    };
  }, [openFromDetail]);

  const close = useCallback(() => {
    clearActiveRoomSession();
    setSession(null);
  }, []);

  if (!session) return null;

  return (
    <div
      className="fixed inset-0 z-[3000] bg-black text-white"
      data-instant-room-entry
      data-room-path={session.path}
    >
      {/* Instant paint — visible before the room chunk resolves */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
        {(session.roomName || session.hostName) && (
          <p className="max-w-[80%] truncate text-center text-sm font-semibold text-white/80">
            {session.roomName || session.hostName}
          </p>
        )}
        <div className="h-10 w-10 animate-pulse rounded-full bg-white/20" aria-hidden />
      </div>

      <Suspense fallback={null}>
        <KaraokeSmuleRoomFlow
          flowKey={session.flowKey}
          initialPath={session.path}
          flowEntry={session.entry}
          embedVariant="full"
          onClose={close}
        />
      </Suspense>
    </div>
  );
}
