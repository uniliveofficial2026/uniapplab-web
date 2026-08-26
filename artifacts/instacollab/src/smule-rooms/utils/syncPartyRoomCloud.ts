import { isCloudAuthUserId } from '../../lib/auth/cloudProfile';
import {
  isHostLiveEnded,
  isHostUserLiveEnded,
} from '../../lib/live/hostLiveEndedRegistry';
import { isPartyCloudAvailable } from '../../lib/party/partyCloud';
import { upsertPartyRoom } from '../../lib/party/partyRoomsCloud';
import type { RoomSettings } from './storage';
import { resolveRoomKeyHashForSync } from './hydrateRoomPrivacyFromCloud';
import { resolveRoomPrivacy } from './roomPrivacy';
import { normalizeStorageRoomMode } from '../../lib/liveRing';
import {
  normalizeWhoCanBeSeated,
  resolveSeatJoinMode,
} from './roomJoinPolicy';

export type PartyRoomSyncQa = {
  at: number;
  appRoomId: string;
  ownerIdHash?: string;
  roomMode?: string;
  status: 'skipped' | 'ok' | 'fail';
  reason?: string;
};

type PartyRoomSyncWindow = Window & {
  __UNILIVE_PARTY_ROOM_SYNC_QA__?: PartyRoomSyncQa;
};

function hashId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `h${(h >>> 0).toString(16).padStart(8, '0')}`;
}

function publishSyncQa(snap: PartyRoomSyncQa): void {
  if (typeof window === 'undefined') return;
  try {
    (window as PartyRoomSyncWindow).__UNILIVE_PARTY_ROOM_SYNC_QA__ = snap;
    console.info('[PartyRoomSync]', snap);
  } catch {
    /* ignore */
  }
}

/**
 * Persist Solo/party Live room to control-plane SSOT (`party_rooms`).
 * Fire-and-forget wrapper kept for call sites; prefer `syncPartyRoomToCloudAsync` when await matters.
 */
export function syncPartyRoomToCloud(
  roomId: string,
  ownerId: string | null | undefined,
  settings: Pick<
    RoomSettings,
    'roomName' | 'roomMode' | 'privacy' | 'whoCanJoin' | 'coverPhoto' | 'roomKey'
  > &
    Partial<Pick<RoomSettings, 'whoCanBeSeated' | 'seatJoinMode'>>,
  options?: { pkActive?: boolean },
): void {
  void syncPartyRoomToCloudAsync(roomId, ownerId, settings, options);
}

/** Awaitable Solo Live registration — surfaces sync QA for discovery proof. */
export async function syncPartyRoomToCloudAsync(
  roomId: string,
  ownerId: string | null | undefined,
  settings: Pick<
    RoomSettings,
    'roomName' | 'roomMode' | 'privacy' | 'whoCanJoin' | 'coverPhoto' | 'roomKey'
  > &
    Partial<Pick<RoomSettings, 'whoCanBeSeated' | 'seatJoinMode'>>,
  options?: { pkActive?: boolean },
): Promise<boolean> {
  if (!roomId || !ownerId || !isPartyCloudAvailable() || !isCloudAuthUserId(ownerId)) {
    publishSyncQa({
      at: Date.now(),
      appRoomId: String(roomId || ''),
      ownerIdHash: hashId(ownerId || undefined),
      status: 'skipped',
      reason: !roomId
        ? 'missing-room'
        : !ownerId
          ? 'missing-owner'
          : !isPartyCloudAvailable()
            ? 'cloud-unavailable'
            : 'owner-not-cloud-auth',
    });
    return false;
  }
  if (isHostLiveEnded(roomId) || isHostUserLiveEnded(ownerId)) {
    publishSyncQa({
      at: Date.now(),
      appRoomId: roomId,
      ownerIdHash: hashId(ownerId),
      status: 'skipped',
      reason: 'host-live-ended',
    });
    return false;
  }

  const privacy = resolveRoomPrivacy(settings);
  const roomMode = normalizeStorageRoomMode(String(settings.roomMode ?? 'Chat'));
  const seatJoinMode = resolveSeatJoinMode(settings);
  const whoCanBeSeated = normalizeWhoCanBeSeated(settings.whoCanBeSeated);
  const modeTag = String(roomMode ?? 'Chat');
  const pkAllowed =
    Boolean(options?.pkActive) &&
    (modeTag === 'Solo-Live' || modeTag === 'Commerce-Live');
  const tags = pkAllowed ? ['pk', modeTag] : [modeTag];

  if (isHostLiveEnded(roomId) || isHostUserLiveEnded(ownerId)) return false;
  const room_key_hash = await resolveRoomKeyHashForSync(privacy, settings.roomKey);
  if (isHostLiveEnded(roomId) || isHostUserLiveEnded(ownerId)) return false;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await upsertPartyRoom(
        {
          id: roomId,
          owner_id: ownerId,
          room_name: settings.roomName?.trim() || `Room ${roomId}`,
          room_mode: modeTag,
          privacy,
          join_policy: settings.whoCanJoin ?? (privacy === 'Private' ? 'Private Key Required' : 'Anyone'),
          room_key_hash,
          seat_join_mode: seatJoinMode,
          who_can_be_seated: whoCanBeSeated,
          cover_url:
            settings.coverPhoto &&
            settings.coverPhoto !== 'Default' &&
            settings.coverPhoto.startsWith('http')
              ? settings.coverPhoto
              : null,
          tags,
          status: 'active',
        },
        ownerId,
      );
      publishSyncQa({
        at: Date.now(),
        appRoomId: roomId,
        ownerIdHash: hashId(ownerId),
        roomMode: modeTag,
        status: 'ok',
      });
      return true;
    } catch (err) {
      lastErr = err;
      console.warn(`[party-room] cloud sync failed attempt=${attempt}`, err);
    }
  }

  publishSyncQa({
    at: Date.now(),
    appRoomId: roomId,
    ownerIdHash: hashId(ownerId),
    roomMode: modeTag,
    status: 'fail',
    reason: lastErr instanceof Error ? lastErr.message.slice(0, 120) : 'upsert-failed',
  });
  return false;
}
