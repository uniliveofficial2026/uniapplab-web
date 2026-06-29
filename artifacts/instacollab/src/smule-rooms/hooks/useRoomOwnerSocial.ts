import { useCallback, useMemo, useState } from 'react';
import { db } from '../../lib/db/localDb';
import { getRoomGiftSummary } from '../utils/roomGifts';
import { resolveOwnerMemberIdentity } from '../utils/roomMemberProfile';
import { viewerFollowsRoomOwner } from '../utils/roomFollowContext';
import {
  resolveOwnerDisplayName,
  resolveOwnerUserId,
} from '../utils/roomRoleUsers';
import type { RoomSettings } from '../utils/storage';

type RoomOwnerSocialSettings = Pick<
  RoomSettings,
  'roomId' | 'owner' | 'ownerUserId' | 'roomName'
>;

export type RoomOwnerViewerPayload = {
  id: string;
  name: string;
  avatar: string;
  isOwner: boolean;
  isAdmin: boolean;
  isFollowing: boolean;
};

export function useRoomOwnerSocial(
  roomId: string,
  settings: RoomOwnerSocialSettings,
  viewerUserId: string,
  options?: { onToast?: (message: string) => void },
) {
  const [followRevision, setFollowRevision] = useState(0);

  const ownerIdentity = useMemo(
    () => resolveOwnerMemberIdentity(settings as RoomSettings, 'Host', 80),
    [settings],
  );

  const ownerUserId = resolveOwnerUserId(settings as RoomSettings);
  const isSelfOwner = Boolean(ownerUserId && ownerUserId === viewerUserId);

  const isFollowingOwner = useMemo(() => {
    void followRevision;
    return viewerFollowsRoomOwner(settings as RoomSettings, viewerUserId);
  }, [settings, viewerUserId, followRevision]);

  const starCount = useMemo(() => getRoomGiftSummary(roomId).totalStars, [roomId]);

  const toggleFollowOwner = useCallback(() => {
    if (!ownerUserId || ownerUserId === viewerUserId) {
      options?.onToast?.('Cannot follow yourself');
      return;
    }
    const following = db.toggleFollow(ownerUserId);
    if (following === null) return;
    options?.onToast?.(
      following
        ? `Followed ${resolveOwnerDisplayName(settings as RoomSettings, 'Host')}`
        : `Unfollowed ${resolveOwnerDisplayName(settings as RoomSettings, 'Host')}`,
    );
    setFollowRevision((value) => value + 1);
  }, [ownerUserId, viewerUserId, settings, options]);

  const ownerViewerPayload = useMemo((): RoomOwnerViewerPayload => {
    return {
      id: ownerUserId ?? ownerIdentity.userId ?? 'owner',
      name: ownerIdentity.name,
      avatar: ownerIdentity.avatarUrl,
      isOwner: true,
      isAdmin: false,
      isFollowing: isFollowingOwner,
    };
  }, [ownerIdentity, ownerUserId, isFollowingOwner]);

  return {
    ownerIdentity,
    ownerUserId,
    isSelfOwner,
    isFollowingOwner,
    starCount,
    toggleFollowOwner,
    ownerViewerPayload,
  };
}
