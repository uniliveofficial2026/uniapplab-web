/**
 * RoomService — LiveKit tokens + stream start/stop via platformApi.
 * A/V transport is LiveKit (TRTC available via livestream adapter).
 */
import {
  fetchLiveKitToken,
  fetchPartyLiveKitToken,
  fetchChatLiveKitToken,
  startStream,
  stopStream,
  fetchLiveStreams,
  postStreamViewer,
  fetchStreamViewers,
} from '../lib/platformApi';
import type { ServiceResult } from '../types/platform';

export interface RoomService {
  getStreamToken(
    streamId: string,
    role?: 'host' | 'viewer',
  ): Promise<ServiceResult<unknown>>;
  getPartyToken(roomId: string, publish?: boolean): Promise<ServiceResult<unknown>>;
  getChatToken(
    threadId: string,
    callKind?: 'audio' | 'video',
  ): Promise<ServiceResult<unknown>>;
  startLive(title?: string): Promise<ServiceResult<{ id: string }>>;
  stopLive(streamId: string): Promise<ServiceResult<unknown>>;
  listLive(): Promise<ServiceResult<{ streams: unknown[] }>>;
  postViewer(
    streamId: string,
    action: 'join' | 'leave',
  ): Promise<ServiceResult<unknown>>;
  listViewers(streamId: string): Promise<ServiceResult<unknown>>;
}

class RoomServiceImpl implements RoomService {
  async getStreamToken(
    streamId: string,
    role: 'host' | 'viewer' = 'viewer',
  ): Promise<ServiceResult<unknown>> {
    try {
      const data = await fetchLiveKitToken(streamId, role);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async getPartyToken(roomId: string, publish = true): Promise<ServiceResult<unknown>> {
    try {
      const data = await fetchPartyLiveKitToken(roomId, publish);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async getChatToken(
    threadId: string,
    callKind: 'audio' | 'video' = 'audio',
  ): Promise<ServiceResult<unknown>> {
    try {
      const data = await fetchChatLiveKitToken(threadId, callKind);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async startLive(title?: string): Promise<ServiceResult<{ id: string }>> {
    try {
      const data = await startStream(title);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async stopLive(streamId: string): Promise<ServiceResult<unknown>> {
    try {
      const data = await stopStream(streamId);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async listLive(): Promise<ServiceResult<{ streams: unknown[] }>> {
    try {
      const data = await fetchLiveStreams();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async postViewer(
    streamId: string,
    action: 'join' | 'leave',
  ): Promise<ServiceResult<unknown>> {
    try {
      const data = await postStreamViewer(streamId, action);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async listViewers(streamId: string): Promise<ServiceResult<unknown>> {
    try {
      const data = await fetchStreamViewers(streamId);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const roomService: RoomService = new RoomServiceImpl();
