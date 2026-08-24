import { fetchLiveStreams } from '../../lib/platformApi';
import type { LiveRoomViewModel, UserSummaryViewModel } from '../../presentation/view-models/types';
import { loadGiftPanel } from '../gifts/giftDomain';

function emptyHost(): UserSummaryViewModel {
  return { userId: '', displayName: '', username: '', avatarUrl: '' };
}

export async function loadLiveDiscoveryRooms(): Promise<Array<Pick<LiveRoomViewModel, 'roomId' | 'roomType' | 'title' | 'viewerCount' | 'status'>>> {
  try {
    const data = await fetchLiveStreams();
    const streams = Array.isArray(data.streams) ? data.streams : [];
    return streams.map((raw) => {
      const s = raw as Record<string, unknown>;
      return {
        roomId: String(s.id ?? ''),
        roomType: String(s.room_type ?? s.roomType ?? 'solo_video'),
        title: String(s.title ?? ''),
        viewerCount: Number(s.viewer_count ?? s.viewerCount ?? 0),
        status: 'ready' as const,
      };
    });
  } catch {
    return [];
  }
}

export async function loadLiveRoomViewModel(input: {
  roomId: string;
  roomType?: string;
  title?: string;
  host: UserSummaryViewModel;
  viewerCount?: number;
  canPublish: boolean;
  canRequestSeat: boolean;
  isHost: boolean;
}): Promise<LiveRoomViewModel> {
  const giftPanel = await loadGiftPanel(true);
  return {
    roomId: input.roomId,
    roomType: input.roomType || 'solo_video',
    title: input.title || '',
    host: input.host.userId ? input.host : emptyHost(),
    viewerCount: input.viewerCount ?? 0,
    seats: [],
    pk: null,
    giftPanel,
    permissions: {
      canPublish: { allowed: input.canPublish },
      canRequestSeat: { allowed: input.canRequestSeat },
      canApproveSeat: { allowed: input.isHost },
      canSendGift: { allowed: true },
      canInvitePk: { allowed: input.isHost },
    },
    status: 'ready',
  };
}
