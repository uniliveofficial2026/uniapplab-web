import type { LiveKind } from '../../types';
import type { RoomFlowEntry } from '../../smule-rooms/context/RoomFlowContext';
import type { PendingCrossRoomPk } from '../../smule-rooms/utils/pkPendingChallenge';
import { roomModeFromLiveKind } from '../liveRing';
import {
  dispatchRoomsLiveOpen,
  stashPendingLiveRoomOpen,
  type PendingLiveRoomOpen,
} from './pendingLiveRoomOpen';

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

function resolveRoomPath(detail: OpenKaraokeRoomDetail): {
  path: string;
  roomId?: string;
} {
  const path =
    detail.path ||
    (detail.roomId ? `/room/${detail.roomId}` : '/room/create');
  const roomId =
    detail.roomId ??
    (path.startsWith('/room/') && path !== '/room/create'
      ? path.replace(/^\/room\//, '').split('/')[0]
      : undefined);
  return { path, roomId };
}

/**
 * Instant enter — stash pending + paint App-level room host on the same click turn.
 * Does not wait on karaoke tab navigation or dynamic imports.
 */
export function openInstantRoomFlow(detail: OpenKaraokeRoomDetail): void {
  const { path, roomId } = resolveRoomPath(detail);
  const payload: OpenKaraokeRoomDetail = {
    ...detail,
    path,
    roomId,
    entry: detail.entry ?? 'karaoke-party',
  };

  pendingKaraokeRoomOpen = payload;

  if (payload.asViewer) {
    try {
      localStorage.setItem('currentUserRole', 'user');
    } catch {
      /* ignore */
    }
  }
  if (roomId) {
    try {
      localStorage.setItem('activeRoomId', roomId);
    } catch {
      /* ignore */
    }
  }

  window.dispatchEvent(new CustomEvent('instant-room-open', { detail: payload }));
  // Keep legacy listeners (KaraokeScreen / RoomsHost) in sync without tab switch.
  window.dispatchEvent(new CustomEvent('karaoke-room-open', { detail: payload }));
  requestAnimationFrame(() => {
    window.dispatchEvent(new CustomEvent('instant-room-open', { detail: payload }));
    window.dispatchEvent(new CustomEvent('karaoke-room-open', { detail: payload }));
  });
}

/** @deprecated Prefer openInstantRoomFlow — kept for call sites that expect karaoke naming. */
export function openKaraokeRoomFlow(detail: OpenKaraokeRoomDetail): void {
  openInstantRoomFlow(detail);
}

let karaokePreload: Promise<unknown> | null = null;
let roomsPreload: Promise<unknown> | null = null;
let liveKitPreload: Promise<unknown> | null = null;
let roomFlowPreload: Promise<unknown> | null = null;

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

/** Warm LiveKit client so A/V connect is not blocked on a cold vendor chunk. */
export function preloadLiveKitClient(): Promise<unknown> {
  if (!liveKitPreload) {
    liveKitPreload = import('../rtc/livekitCompatibilityBoundary').catch(() => {
      liveKitPreload = null;
    });
  }
  return liveKitPreload;
}

function preloadRoomFlowChunk(): Promise<unknown> {
  if (!roomFlowPreload) {
    roomFlowPreload = import('../../components/karaoke/KaraokeSmuleRoomFlow').catch(() => {
      roomFlowPreload = null;
    });
  }
  return roomFlowPreload;
}

/** Warm every chunk needed to enter a live/party room from discovery. */
export function preloadLiveRoomEntry(): Promise<unknown> {
  return Promise.all([
    preloadRoomFlowChunk(),
    preloadLiveKitClient(),
    preloadKaraokeScreen(),
    preloadRoomsHost(),
  ]);
}

/** Open Create Room (Go Live) — instant App-level room shell. */
export function openGoLiveCreateRoom(options?: { mode?: string; roomName?: string }): void {
  void preloadLiveRoomEntry();
  void import('../preloadAppSurfaces').then((m) => m.preloadHostMediaPath());
  // Live discovery "Go Live" implies camera Solo by default (CreateRoom otherwise defaults to Chat,
  // which never mounts SoloLiveView / live-chat-input).
  try {
    sessionStorage.setItem(
      'uni.createRoom.hint',
      JSON.stringify({
        mode: options?.mode || 'Solo-Live',
        roomName: options?.roomName || undefined,
      }),
    );
  } catch {
    /* ignore */
  }
  openInstantRoomFlow({
    path: '/room/create',
    entry: 'karaoke-party',
  });
}

function seedRoomSettingsForJoinFast(options: {
  roomId: string;
  roomName: string;
  roomMode: string;
  hostUserId: string;
  hostName: string;
  asViewer: boolean;
}): void {
  void Promise.all([
    import('../../smule-rooms/utils/storage'),
    import('../../smule-rooms/utils/roomRoleUsers'),
  ])
    .then(([{ ensureRoomSettingsSeeded, saveRoomSettings }, { ensureRoomRoleUserIds }]) => {
      const roomMode = options.roomMode as never;
      ensureRoomSettingsSeeded(options.roomId, {
        roomId: options.roomId,
        roomName: options.roomName,
        roomMode,
        owner: options.hostName,
        ownerUserId: options.hostUserId,
        hostUserId: options.hostUserId,
        host: options.hostName,
      });
      if (options.asViewer) {
        saveRoomSettings(options.roomId, {
          roomId: options.roomId,
          roomName: options.roomName,
          roomMode,
          owner: options.hostName,
          ownerUserId: options.hostUserId,
          hostUserId: options.hostUserId,
          host: options.hostName,
        });
      }
      ensureRoomRoleUserIds(options.roomId);
      localStorage.setItem('activeRoomId', options.roomId);
    })
    .catch(() => {});

  void import('../../smule-rooms/utils/hydrateRoomPrivacyFromCloud')
    .then((m) =>
      m.hydrateRoomPrivacyFromCloud(options.roomId, {
        viewerUserId: options.asViewer ? null : options.hostUserId,
      }),
    )
    .catch(() => {});
}

function openDiscoveryViewerRoom(options: {
  roomId: string;
  roomName?: string;
  roomMode?: string;
  hostUserId: string;
  hostName?: string;
  liveKind?: LiveKind;
}): void {
  void preloadLiveRoomEntry();

  const path = `/room/${options.roomId}`;
  const roomMode =
    options.roomMode?.trim() ||
    (options.liveKind ? roomModeFromLiveKind(options.liveKind) : '') ||
    'Solo-Live';
  const roomName = options.roomName?.trim() || `${options.hostName || 'Live'} room`;
  const hostUserId = options.hostUserId;
  const hostName = options.hostName?.trim() || roomName || 'Host';

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
  openInstantRoomFlow({
    path,
    roomId: options.roomId,
    entry: 'live-discovery',
    roomName,
    roomMode,
    hostUserId,
    hostName,
    asViewer: true,
  });
  dispatchRoomsLiveOpen(payload);

  seedRoomSettingsForJoinFast({
    roomId: options.roomId,
    roomName,
    roomMode,
    hostUserId,
    hostName,
    asViewer: true,
  });
}

async function findOwnerPartyRoomInActiveList(ownerId: string): Promise<string | null> {
  try {
    const { fetchActivePartyRooms } = await import('../party/partyRoomsCloud');
    const rows = await fetchActivePartyRooms(50, ownerId);
    const match = rows.find((row) => row.owner_id === ownerId && row.status !== 'ended');
    return match?.id?.trim() || null;
  } catch {
    return null;
  }
}

function openResolvedViewerRoom(
  roomId: string,
  options: {
    hostUserId: string;
    roomName?: string;
    roomMode?: string;
    hostName?: string;
    liveKind?: LiveKind;
  },
): boolean {
  openDiscoveryViewerRoom({
    roomId,
    roomName: options.roomName,
    roomMode: options.roomMode,
    hostUserId: options.hostUserId,
    hostName: options.hostName,
    liveKind: options.liveKind,
  });
  void import('../party/partyRoomsCloud')
    .then(async (m) => {
      const row = await m.fetchPartyRoomById(roomId);
      if (!row) return;
      const { applyCloudPrivacyToLocalSettings } = await import(
        '../../smule-rooms/utils/hydrateRoomPrivacyFromCloud'
      );
      applyCloudPrivacyToLocalSettings(roomId, row, { viewerUserId: null });
    })
    .catch(() => {});
  return true;
}

/**
 * Open a live host's party room from the Live discovery feed.
 * Card metadata opens the room shell synchronously; cloud id resolve only when needed.
 */
export async function openLiveUserRoom(
  hostUserId: string,
  options?: OpenLiveUserRoomOptions,
): Promise<boolean> {
  const hostId = hostUserId.trim();
  if (!hostId) return false;

  void preloadLiveRoomEntry();

  const hostName = options?.hostName?.trim() || '';
  let roomId = options?.partyRoomId?.trim() || '';
  const roomName = options?.roomName?.trim() || '';
  const roomMode = options?.roomMode?.trim() || '';

  if (!roomId) {
    try {
      const stored = localStorage.getItem(`ownerCanonicalPartyRoomId:${hostId}`)?.trim();
      if (stored && /^\d{7}$/.test(stored)) roomId = stored;
    } catch {
      /* ignore */
    }
  }

  if (roomId) {
    return openResolvedViewerRoom(roomId, {
      hostUserId: hostId,
      roomName,
      roomMode,
      hostName,
      liveKind: options?.liveKind,
    });
  }

  const { getStoredOwnerPartyRoomId, findOwnedManagedRoomId, resolveLocalOwnerPartyRoomId } =
    await import('../../smule-rooms/utils/ownerPartyRoomId');
  const localId = getStoredOwnerPartyRoomId(hostId) ?? findOwnedManagedRoomId(hostId);
  if (localId) {
    return openResolvedViewerRoom(localId, {
      hostUserId: hostId,
      roomName,
      roomMode,
      hostName,
      liveKind: options?.liveKind,
    });
  }

  try {
    const { fetchOwnerActivePartyRoom } = await import('../party/partyRoomsCloud');
    const cloud = await fetchOwnerActivePartyRoom(hostId);
    if (cloud?.id) {
      return openResolvedViewerRoom(cloud.id, {
        hostUserId: cloud.owner_id || hostId,
        roomName: roomName || cloud.room_name || '',
        roomMode: roomMode || cloud.room_mode || '',
        hostName,
        liveKind: options?.liveKind,
      });
    }
  } catch {
    /* fall through */
  }

  const scannedId = await findOwnerPartyRoomInActiveList(hostId);
  if (scannedId) {
    return openResolvedViewerRoom(scannedId, {
      hostUserId: hostId,
      roomName,
      roomMode,
      hostName,
      liveKind: options?.liveKind,
    });
  }

  const hostAppearsLive = Boolean(options?.liveKind || roomMode || roomName);
  if (hostAppearsLive) {
    const seededId = resolveLocalOwnerPartyRoomId(hostId, { createIfMissing: true });
    if (seededId) {
      return openResolvedViewerRoom(seededId, {
        hostUserId: hostId,
        roomName,
        roomMode,
        hostName,
        liveKind: options?.liveKind,
      });
    }
  }

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

  const roomId =
    getStoredOwnerPartyRoomId(ownerUserId) ??
    resolveLocalOwnerPartyRoomId(ownerUserId, { createIfMissing: true });
  if (!roomId) return;

  setPendingCrossRoomPk(challenge);
  void preloadLiveRoomEntry();
  const path = `/room/${roomId}`;
  const payload: PendingLiveRoomOpen = {
    path,
    roomId,
    entry: 'live-discovery',
    asViewer: false,
  };
  stashPendingLiveRoomOpen(payload);
  openInstantRoomFlow({
    path,
    roomId,
    entry: 'live-discovery',
    asViewer: false,
  });
  dispatchRoomsLiveOpen(payload);
}
