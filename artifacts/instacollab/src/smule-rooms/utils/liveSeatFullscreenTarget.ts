import type { LiveSeatFullscreenTarget } from '../components/LiveSeatFullscreenOverlay';
import { resolveSeatVideoUserId } from '../hooks/useMultiGuestLiveKit';
import type { RoomGuest } from './roomSeats';

export function buildLiveSeatFullscreenTarget(
  seatKey: string,
  guest: RoomGuest,
  roomDisplayId: string,
  opts: { userSeatKey?: string | null; selfUserId?: string },
): LiveSeatFullscreenTarget {
  const isSelf =
    Boolean(opts.userSeatKey && opts.userSeatKey === seatKey) ||
    Boolean(
      opts.selfUserId &&
        guest.userId?.trim() &&
        guest.userId.trim() === opts.selfUserId.trim(),
    );
  return {
    seatKey,
    guestName: guest.name,
    guestAvatar: guest.avatar,
    guestUserId: resolveSeatVideoUserId(guest, roomDisplayId),
    isSelf,
  };
}
