import { useEffect, useRef, useState } from 'react';
import { isCloudAuthUserId } from '../../lib/auth/cloudProfile';
import {
  isPartyRoomPresenceCloudAvailable,
  subscribePartyRoomPresence,
  unsubscribePartyRoomPresence,
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
};

function presenceToViewer(member: PartyRoomPresencePayload): RoomViewerEntry {
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

export function usePartyRoomPresence({ roomId, enabled, self }: UsePartyRoomPresenceOptions) {
  const cloudActive =
    enabled && isPartyRoomPresenceCloudAvailable() && isCloudAuthUserId(self.id);
  const [remoteViewers, setRemoteViewers] = useState<RoomViewerEntry[]>([]);
  const channelRef = useRef<ReturnType<typeof subscribePartyRoomPresence>>(null);

  useEffect(() => {
    setRemoteViewers([]);
    if (!cloudActive) return undefined;

    channelRef.current = subscribePartyRoomPresence(
      roomId,
      {
        user_id: self.id,
        name: self.roomName,
        avatar_url: self.avatarUrl,
        joined_at: Date.now(),
      },
      (members) => {
        setRemoteViewers(members.map((member) => presenceToViewer(member)));
      },
    );

    return () => {
      unsubscribePartyRoomPresence(channelRef.current);
      channelRef.current = null;
    };
  }, [cloudActive, roomId, self.avatarUrl, self.id, self.roomName]);

  return { remoteViewers, cloudActive };
}
