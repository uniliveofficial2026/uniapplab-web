/**
 * DEBUG/QA-only active Solo Live diagnostic.
 * Safe metadata only — no access/refresh/LiveKit tokens or credentials.
 */
import { hashId } from '../camera/cameraSwitchTrace';

export type ActiveLiveQaSnapshot = {
  appRoomId: string;
  rtcRoomNameHash?: string;
  roomType: string;
  hostPersonHash?: string;
  liveState: string;
  rtcState: string;
  at: number;
};

type ActiveLiveQaWindow = Window & {
  __UNILIVE_ACTIVE_LIVE_QA__?: ActiveLiveQaSnapshot;
};

export function publishActiveLiveQa(partial: {
  appRoomId?: string | null;
  rtcRoomName?: string | null;
  roomType?: string | null;
  hostPersonId?: string | null;
  liveState?: string | null;
  rtcState?: string | null;
}): ActiveLiveQaSnapshot | null {
  if (typeof window === 'undefined') return null;
  const appRoomId = String(partial.appRoomId || '').trim();
  if (!appRoomId) return null;

  const snap: ActiveLiveQaSnapshot = {
    appRoomId,
    rtcRoomNameHash: hashId(partial.rtcRoomName?.trim() || undefined),
    roomType: String(partial.roomType || 'solo').trim() || 'solo',
    hostPersonHash: hashId(partial.hostPersonId?.trim() || undefined),
    liveState: String(partial.liveState || 'unknown').trim() || 'unknown',
    rtcState: String(partial.rtcState || 'unknown').trim() || 'unknown',
    at: Date.now(),
  };

  try {
    (window as ActiveLiveQaWindow).__UNILIVE_ACTIVE_LIVE_QA__ = snap;
    console.info('[ActiveLiveQa]', {
      appRoomId: snap.appRoomId,
      roomType: snap.roomType,
      liveState: snap.liveState,
      rtcState: snap.rtcState,
      hostPersonHash: snap.hostPersonHash,
      rtcRoomNameHash: snap.rtcRoomNameHash,
    });
  } catch {
    /* ignore */
  }
  return snap;
}

export function clearActiveLiveQa(): void {
  if (typeof window === 'undefined') return;
  try {
    delete (window as ActiveLiveQaWindow).__UNILIVE_ACTIVE_LIVE_QA__;
  } catch {
    /* ignore */
  }
}
