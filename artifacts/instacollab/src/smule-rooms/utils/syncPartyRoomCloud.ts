import { isCloudAuthUserId } from '../../lib/auth/cloudProfile';
import { resolveSupabaseSessionUserId } from '../../lib/auth/resolveSupabaseSessionUserId';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import { upsertPartyRoom } from '../../lib/supabase/partyRooms';
import type { RoomSettings } from './storage';
import { resolveRoomPrivacy } from './roomPrivacy';

export function syncPartyRoomToCloud(
  roomId: string,
  ownerId: string | null | undefined,
  settings: Pick<
    RoomSettings,
    'roomName' | 'roomMode' | 'privacy' | 'whoCanJoin' | 'coverPhoto'
  >,
): void {
  if (!roomId || !isSupabaseConfigured()) return;

  void resolveSupabaseSessionUserId(ownerId, { attemptMigrate: true }).then((authOwnerId) => {
    if (!authOwnerId || !isCloudAuthUserId(authOwnerId)) return;

    const privacy = resolveRoomPrivacy(settings);
    void upsertPartyRoom({
      id: roomId,
      owner_id: authOwnerId,
      room_name: settings.roomName?.trim() || `Room ${roomId}`,
      room_mode: String(settings.roomMode ?? 'Chat'),
      privacy,
      join_policy: settings.whoCanJoin ?? 'Anyone',
      cover_url:
        settings.coverPhoto && settings.coverPhoto !== 'Default' && settings.coverPhoto.startsWith('http')
          ? settings.coverPhoto
          : null,
      tags: [String(settings.roomMode ?? 'Chat')],
      status: 'active',
    }).catch((err) => {
      console.warn('[party-room] cloud sync failed:', err);
    });
  });
}
