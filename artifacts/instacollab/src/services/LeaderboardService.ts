/**
 * LeaderboardService — gift room rankings via Edge.
 */
import { fetchGiftRoomRankingsApi } from '../lib/platformApi';
import type { ServiceResult } from '../types/platform';

export interface LeaderboardService {
  giftRoomRankings(
    roomId: string,
    role?: 'sender' | 'receiver',
  ): Promise<ServiceResult<unknown>>;
}

class LeaderboardServiceImpl implements LeaderboardService {
  async giftRoomRankings(
    roomId: string,
    role: 'sender' | 'receiver' = 'sender',
  ): Promise<ServiceResult<unknown>> {
    try {
      const data = await fetchGiftRoomRankingsApi(roomId, role);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const leaderboardService: LeaderboardService = new LeaderboardServiceImpl();
