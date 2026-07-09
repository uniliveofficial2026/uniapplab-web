import type { LiveKind } from '../../types';
import type { RoomFlowEntry } from '../../smule-rooms/context/RoomFlowContext';
import type { PendingCrossRoomPk } from '../../smule-rooms/utils/pkPendingChallenge';
import type { PendingLiveRoomOpen } from './pendingLiveRoomOpen';

export type OpenKaraokeRoomDetail = {
  path?: string;
  roomId?: string;
  entry?: RoomFlowEntry;
  roomName?: string;
  roomMode?: string;
  hostUserId?: string;
  hostName?: string;
  asViewer?: boolean;
};

export type OpenLiveUserRoomOptions = {
  partyRoomId?: string | null;
  roomName?: string;
  roomMode?: string;
  hostName?: string;
  liveKind?: LiveKind;
  streamId?: string | null;
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

  pendingKaraokeRoomOpen = payload;

  window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'karaoke' } }));

  const dispatch = () => dispatchKaraokeRoomOpen(payload);
  dispatch();
  requestAnimationFrame(dispatch);
}

let karaokePreload: Promise<unknown> | null = null;
let roomsPreload: Promise<unknown> | null = null;

/** Warm the karaoke chunk so Go Live does not wait on a cold lazy import. */
export function preloadKaraokeScreen(): Promise<unknown> {
  if (!karaokePreload) {
    karaokePreload = import('../../components/karaoke/KaraokeScreen').catch(() => {
      karaokePreload = null;
    });
  }
  return karaokePreload;
}

/** Warm the rooms shell for Live discovery joins. */
export function preloadRoomsHost(): Promise<unknown> {
  if (!roomsPreload) {
    roomsPreload = import('../../smule-rooms/RoomsHost').catch(() => {
      roomsPreload = null;
    });
  }
  return roomsPreload;
}

/** Open Create Room (Go Live) from the Live tab — karaoke embed → CreateRoom. */
export function openGoLiveCreateRoom(): void {
  void preloadKaraokeScreen();
  openKaraokeRoomFlow({
    path: '/room/create',
    entry: 'karaoke-party',
  });
}

async function seedRoomSettingsForJoin(options: {
  roomId: string;
  roomName: string;
  roomMode: string;
  hostUserId: string;
  hostName: string;
  asViewer: boolean;
}): Promise<void> {
  const [
    { ensureRoomSettingsSeeded, saveRoomSettings },
    { ensureRoomRoleUserIds },
  ] = await Promise.all([
    import('../../smule-rooms/utils/storage'),
    import('../../smule-rooms/utils/roomRoleUsers'),
  ]);

  ensureRoomSettingsSeeded(options.roomId, {
    roomId: options.roomId,
    roomName: options.roomName,
    roomMode: options.roomMode,
    owner: options.hostName,
    ownerUserId: options.hostUserId,
    hostUserId: options.hostUserId,
    host: options.hostName,
  });

  if (options.asViewer) {
    saveRoomSettings(options.roomId, {
      roomId: options.roomId,
      roomName: options.roomName,
      roomMode: options.roomMode,
      owner: options.hostName,
      ownerUserId: options.hostUserId,
      hostUserId: options.hostUserId,
      host: options.hostName,
    });
    localStorage.setItem('currentUserRole', 'user');
  }

  ensureRoomRoleUserIds(options.roomId);
  localStorage.setItem('activeRoomId', options.roomId);
}

async function resolveViewerRoomMode(
  roomId: string,
  roomMode?: string,
  liveKind?: LiveKind,
): Promise<string> {
  if (roomMode?.trim()) return roomMode.trim();
  if (liveKind) {
    const { roomModeFromLiveKind } = await import('../liveRing');
    return roomModeFromLiveKind(liveKind);
  }
  const { getRoomSettings } = await import('../../smule-rooms/utils/storage');
  const settings = getRoomSettings(roomId);
  return String(settings.roomMode || '') || 'Solo-Live';
}

async function openDiscoveryViewerRoom(options: {
  roomId: string;
  roomName?: string;
  roomMode?: string;
  hostUserId: string;
  hostName?: string;
  liveKind?: LiveKind;
}): Promise<void> {
  void preloadRoomsHost();

  const { getRoomSettings } = await import('../../smule-rooms/utils/storage');
  const { dispatchRoomsLiveOpen, stashPendingLiveRoomOpen } = await import('./pendingLiveRoomOpen');

  const roomMode = await resolveViewerRoomMode(options.roomId, options.roomMode, options.liveKind);
  const roomName =
    options.roomName?.trim() ||
    getRoomSettings(options.roomId).roomName?.trim() ||
    `${options.hostName || 'Live'} room`;
  const hostUserId = getRoomSettings(options.roomId).ownerUserId || options.hostUserId;
  const hostName = options.hostName?.trim() || roomName || 'Host';
  const path = `/room/${options.roomId}`;

  await seedRoomSettingsForJoin({
    roomId: options.roomId,
    roomName,
    roomMode,
    hostUserId,
    hostName,
    asViewer: true,
  });

  const payload: PendingLiveRoomOpen = {
    path,
    roomId: options.roomId,
    entry: 'live-discovery',
    asViewer: true,
    hostUserId,
    hostName,
    roomName,
    roomMode,
    liveKind: options.liveKind,
  };

  stashPendingLiveRoomOpen(payload);

  window.dispatchEvent(
    new CustomEvent('navigate', {
      detail: { tab: 'rooms', roomsPath: path },
    }),
  );

  dispatchRoomsLiveOpen(payload);
}

/**
 * Open a live host's party room from the Live discovery feed.
 * Card/local metadata opens instantly; cloud resolves room id when missing.
 */
export async function openLiveUserRoom(
  hostUserId: string,
  options?: OpenLiveUserRoomOptions,
): Promise<boolean> {
  const hostId = hostUserId.trim();
  if (!hostId) return false;

  const hostName = options?.hostName?.trim() || '';
  let roomId = options?.partyRoomId?.trim() || '';
  const roomName = options?.roomName?.trim() || '';
  const roomMode = options?.roomMode?.trim() || '';

  if (roomId) {
    await openDiscoveryViewerRoom({
      roomId,
      roomName,
      roomMode,
      hostUserId: hostId,
      hostName,
      liveKind: options?.liveKind,
    });
    void import('../supabase/partyRooms').then((m) => m.fetchPartyRoomById(roomId)).catch(() => {});
    return true;
  }

  const { getStoredOwnerPartyRoomId, findOwnedManagedRoomId } = await import(
    '../../smule-rooms/utils/ownerPartyRoomId'
  );
  const localId = getStoredOwnerPartyRoomId(hostId) ?? findOwnedManagedRoomId(hostId);
  if (localId) {
    await openDiscoveryViewerRoom({
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
    const { fetchOwnerActivePartyRoom } = await import('../party/partyRoomsCloud');
    const cloud = await fetchOwnerActivePartyRoom(hostId);
    if (cloud?.id) {
      await openDiscoveryViewerRoom({
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

  window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'live' } }));
  return false;
}

/** Return to your party room and start a cross-room PK against a live discovery target. */
export async function openOwnPartyRoomForPkChallenge(
  challenge: PendingCrossRoomPk,
  ownerUserId: string,
): Promise<void> {
  const { CROSS_ROOM_PK_ENABLED } = await import('../../smule-rooms/utils/pkCrossRoom');
  if (!CROSS_ROOM_PK_ENABLED) return;

  const { getStoredOwnerPartyRoomId, resolveLocalOwnerPartyRoomId } = await import(
    '../../smule-rooms/utils/ownerPartyRoomId'
  );
  const { setPendingCrossRoomPk } = await import('../../smule-rooms/utils/pkPendingChallenge');
  const { dispatchRoomsLiveOpen, stashPendingLiveRoomOpen } = await import('./pendingLiveRoomOpen');

  const roomId =
    getStoredOwnerPartyRoomId(ownerUserId) ??
    resolveLocalOwnerPartyRoomId(ownerUserId, { createIfMissing: true });
  if (!roomId) return;

  setPendingCrossRoomPk(challenge);
  void preloadRoomsHost();
  const path = `/room/${roomId}`;
  const payload: PendingLiveRoomOpen = {
    path,
    roomId,
    entry: 'live-discovery',
    asViewer: false,
  };
  stashPendingLiveRoomOpen(payload);
  window.dispatchEvent(
    new CustomEvent('navigate', {
      detail: { tab: 'rooms', roomsPath: path },
    }),
  );
  dispatchRoomsLiveOpen(payload);
}
