import {
  fetchOwnerActivePartyRoom,
  fetchPartyRoomById,
} from '../supabase/partyRooms';
import {
  findOwnedManagedRoomId,
  getStoredOwnerPartyRoomId,
} from '../../smule-rooms/utils/ownerPartyRoomId';
import type { RoomFlowEntry } from '../../smule-rooms/context/RoomFlowContext';
import type { RoomMode } from '../../smule-rooms/utils/storage';
import { getRoomSettings } from '../../smule-rooms/utils/storage';
import { roomModeFromLiveKind } from '../liveRing';
import type { LiveKind } from '../../types';

export type OpenKaraokeRoomDetail = {
  path?: string;
  roomId?: string;
  entry?: RoomFlowEntry;
  roomName?: string;
  roomMode?: RoomMode | string;
  hostUserId?: string;
  hostName?: string;
  asViewer?: boolean;
};

let pendingKaraokeRoomOpen: OpenKaraokeRoomDetail | null = null;

export function peekPendingKaraokeRoomOpen(): OpenKaraokeRoomDetail | null {
  return pendingKaraokeRoomOpen;
}

export function consumePendingKaraokeRoomOpen(): OpenKaraokeRoomDetail | null {
  const detail = pendingKaraokeRoomOpen;
  pendingKaraokeRoomOpen = null;
  return detail;
}

function dispatchKaraokeRoomOpen(detail: OpenKaraokeRoomDetail): void {
  window.dispatchEvent(
    new CustomEvent('karaoke-room-open', {
      detail,
    }),
  );
}

/** Navigate to karaoke and open a room flow path (CreateRoom or an existing room). */
export function openKaraokeRoomFlow(detail: OpenKaraokeRoomDetail): void {
  const path =
    detail.path ||
    (detail.roomId ? `/room/${detail.roomId}` : '/room/create');
  const roomId =
    detail.roomId ??
    (path.startsWith('/room/') && path !== '/room/create'
      ? path.replace(/^\/room\//, '').split('/')[0]
      : undefined);

  const payload: OpenKaraokeRoomDetail = {
    ...detail,
    path,
    roomId,
    entry: detail.entry ?? 'karaoke-party',
  };

  // Persist until KaraokeScreen mounts and consumes — tab switch is async.
  pendingKaraokeRoomOpen = payload;

  window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'karaoke' } }));

  const dispatch = () => dispatchKaraokeRoomOpen(payload);
  // Instant open — no artificial delay; rAF only for mount timing.
  dispatch();
  requestAnimationFrame(dispatch);
}

let karaokePreload: Promise<unknown> | null = null;

/** Warm the karaoke chunk so Go Live does not wait on a cold lazy import. */
export function preloadKaraokeScreen(): Promise<unknown> {
  if (!karaokePreload) {
    karaokePreload = import('../../components/karaoke/KaraokeScreen').catch(() => {
      karaokePreload = null;
    });
  }
  return karaokePreload;
}

/** Open Create Room (Go Live / party) from the main Live tab — never blocks on network. */
export function openGoLiveCreateRoom(): void {
  void preloadKaraokeScreen();
  openKaraokeRoomFlow({ path: '/room/create', entry: 'karaoke-party', asViewer: false });
}

export type OpenLiveUserRoomOptions = {
  partyRoomId?: string | null;
  roomName?: string;
  roomMode?: string;
  hostName?: string;
  liveKind?: LiveKind;
  streamId?: string | null;
};

function openViewerRoom(options: {
  roomId: string;
  roomName?: string;
  roomMode?: string;
  hostUserId: string;
  hostName?: string;
  liveKind?: LiveKind;
}): void {
  const settings = getRoomSettings(options.roomId);
  const roomMode =
    options.roomMode ||
    (options.liveKind ? roomModeFromLiveKind(options.liveKind) : '') ||
    String(settings.roomMode || '') ||
    'Solo-Live';
  const roomName =
    options.roomName ||
    settings.roomName ||
    `${options.hostName || 'Live'} room`;
  const hostUserId = settings.ownerUserId || options.hostUserId;

  openKaraokeRoomFlow({
    path: `/room/${options.roomId}`,
    roomId: options.roomId,
    entry: 'karaoke-party',
    roomName,
    roomMode,
    hostUserId,
    hostName: options.hostName || roomName || 'Host',
    asViewer: true,
  });
}

/**
 * Open a live host's party room from the live ring / Live cards.
 * Card/local metadata opens instantly; cloud is only used when no room id is known.
 */
export async function openLiveUserRoom(
  hostUserId: string,
  options?: OpenLiveUserRoomOptions,
): Promise<boolean> {
  const hostId = hostUserId.trim();
  if (!hostId) return false;

  const hostName = options?.hostName?.trim() || '';
  let roomId = options?.partyRoomId?.trim() || '';
  let roomName = options?.roomName?.trim() || '';
  let roomMode = options?.roomMode?.trim() || '';

  if (roomId) {
    openViewerRoom({
      roomId,
      roomName,
      roomMode,
      hostUserId: hostId,
      hostName,
      liveKind: options?.liveKind,
    });
    // Silent enrich — does not block join.
    void fetchPartyRoomById(roomId).catch(() => {});
    return true;
  }

  const localId = getStoredOwnerPartyRoomId(hostId) ?? findOwnedManagedRoomId(hostId);
  if (localId) {
    openViewerRoom({
      roomId: localId,
      roomName,
      roomMode,
      hostUserId: hostId,
      hostName,
      liveKind: options?.liveKind,
    });
    return true;
  }

  try {
    const cloud = await fetchOwnerActivePartyRoom(hostId);
    if (cloud?.id) {
      openViewerRoom({
        roomId: cloud.id,
        roomName: roomName || cloud.room_name || '',
        roomMode: roomMode || cloud.room_mode || '',
        hostUserId: cloud.owner_id || hostId,
        hostName,
        liveKind: options?.liveKind,
      });
      return true;
    }
  } catch {
    /* stay on Live */
  }

  // No joinable room yet — keep user on Live rather than a dead navigation.
  window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'live' } }));
  return false;
}
