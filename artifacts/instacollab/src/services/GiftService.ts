/**
 * GiftService — Edge gifts catalog / send / rankings.
 */
import {
  sendGiftApi,
  fetchGiftCatalogApi,
  fetchGiftHistoryApi,
  fetchGiftRoomRankingsApi,
  type SendGiftRequest,
} from '../lib/platformApi';
import type { ServiceResult } from '../types/platform';

export interface GiftService {
  listCatalog(): Promise<ServiceResult<{ gifts: unknown[] }>>;
  send(payload: SendGiftRequest): Promise<ServiceResult<unknown>>;
  history(limit?: number): Promise<ServiceResult<{ transactions: unknown[] }>>;
  roomRankings(
    roomId: string,
    role?: 'sender' | 'receiver',
  ): Promise<ServiceResult<unknown>>;
}

class GiftServiceImpl implements GiftService {
  async listCatalog(): Promise<ServiceResult<{ gifts: unknown[] }>> {
    try {
      const data = await fetchGiftCatalogApi();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async send(payload: SendGiftRequest): Promise<ServiceResult<unknown>> {
    try {
      const data = await sendGiftApi(payload);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async history(limit = 40): Promise<ServiceResult<{ transactions: unknown[] }>> {
    try {
      const data = await fetchGiftHistoryApi(limit);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async roomRankings(
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

export const giftService: GiftService = new GiftServiceImpl();
