import { useEffect, useRef, useState } from 'react';
import { isCloudAuthUserId } from '../../lib/auth/cloudProfile';
import {
  isPartyRoomPresenceCloudAvailable,
  subscribePartyRoomPresence,
  watchPartyRoomPresence,
  type PartyRoomPresencePayload,
} from '../../lib/supabase/partyRoomPresence';
import type { RoomViewerEntry } from '../utils/roomViewers';

type UsePartyRoomPresenceOptions = {
  roomId: string;
  enabled: boolean;
  self: {
    id: string;
    roomName: string;
    avatarUrl: string;
  };
  /**
   * Observe presence without tracking self or bumping participant_count.
   * Used for backend admin silent watch (private rooms included).
   */
  silent?: boolean;
};

function presenceToViewer(
  member: PartyRoomPresencePayload,
  _roomId: string,
): RoomViewerEntry {
  return {
    id: member.user_id,
    name: member.name,
    avatar: member.avatar_url,
    isFollowing: false,
    isAdmin: false,
    isOwner: false,
    isCoOwner: false,
    joinedAt: member.joined_at || Date.now(),
  };
}

export function usePartyRoomPresence({
  roomId,
  enabled,
  self,
  silent = false,
}: UsePartyRoomPresenceOptions) {
  const cloudActive =
    enabled &&
    isPartyRoomPresenceCloudAvailable() &&
    (silent || isCloudAuthUserId(self.id));
  const [remoteViewers, setRemoteViewers] = useState<RoomViewerEntry[]>([]);
  const channelRef = useRef<ReturnType<typeof subscribePartyRoomPresence>>(null);
  /** Display fields — do not resubscribe presence when only name/avatar cosmetics change. */
  const selfMetaRef = useRef({ roomName: self.roomName, avatarUrl: self.avatarUrl });
  selfMetaRef.current = { roomName: self.roomName, avatarUrl: self.avatarUrl };

  useEffect(() => {
    setRemoteViewers([]);
    if (!cloudActive) return undefined;

    const onSync = (members: PartyRoomPresencePayload[]) => {
      setRemoteViewers(members.map((member) => presenceToViewer(member, roomId)));
    };

    const handle = silent
      ? watchPartyRoomPresence(roomId, onSync)
      : subscribePartyRoomPresence(
          roomId,
          {
            user_id: self.id,
            name: selfMetaRef.current.roomName,
            avatar_url: selfMetaRef.current.avatarUrl,
            joined_at: Date.now(),
          },
          onSync,
        );
    channelRef.current = handle;

    return () => {
      handle?.unsubscribe();
      channelRef.current = null;
    };
  }, [cloudActive, roomId, self.id, silent]);

  return { remoteViewers, cloudActive };
}
