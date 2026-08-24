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
  if (!roomId || !ownerId || !isPartyCloudAvailable() || !isCloudAuthUserId(ownerId)) {
    return;
  }
  // Never resurrect discovery after End Live (beats in-flight heartbeats).
  if (isHostLiveEnded(roomId) || isHostUserLiveEnded(ownerId)) {
    return;
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

  void (async () => {
    if (isHostLiveEnded(roomId) || isHostUserLiveEnded(ownerId)) return;
    const room_key_hash = await resolveRoomKeyHashForSync(privacy, settings.roomKey);
    if (isHostLiveEnded(roomId) || isHostUserLiveEnded(ownerId)) return;
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
    } catch (err) {
      console.warn('[party-room] cloud sync failed:', err);
    }
  })();
}
