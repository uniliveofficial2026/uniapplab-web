/**
 * Instant LiveKit for calls, live, party, multi-guest:
 * - UI (avatars/posters/local camera) paints first
 * - Connect is background with short timeout
 * - Slow/offline: local UI keeps working; A/V upgrades when ready
 *
 * Stage B: connects through @unilives/rtc-livekit (UniLiveRTC provider),
 * then exposes the native Room only via the documented compatibility boundary.
 */
import {
  RoomEvent,
  type Room,
  type RoomOptions,
  type RoomConnectOptions,
} from '../rtc/livekitCompatibilityBoundary';
import { isLiveKitConfigured } from './livekitConfig';
import { isNetworkOnline } from '../networkStatus';
import { NET_API_FAST_MS, withTimeout } from '../networkPolicy';

export type LiveKitConnectResult =
  | { ok: true; room: Room }
  | { ok: false; reason: string };

/** Room options tuned for slow bandwidth + clear adaptive quality. */
export function instantRoomOptions(overrides?: RoomOptions): RoomOptions {
  return {
    adaptiveStream: true,
    dynacast: true,
    disconnectOnPageLeave: true,
    reconnectPolicy: undefined,
    ...overrides,
  };
}

export function canAttemptLiveKit(): boolean {
  return isLiveKitConfigured() && isNetworkOnline();
}

/**
 * Connect with a hard timeout so slow token/network never hangs the UI.
 * Caller should already be showing local avatars/posters/camera.
 */
export async function connectLiveKitRoom(options: {
  token: string;
  url: string;
  roomName?: string;
  timeoutMs?: number;
  roomOptions?: RoomOptions;
  connectOptions?: RoomConnectOptions;
  onDisconnected?: () => void;
}): Promise<LiveKitConnectResult> {
  if (!canAttemptLiveKit()) {
    return { ok: false, reason: 'offline_or_unconfigured' };
  }

  const { createLiveKitRTCProvider } = await import('@unilives/rtc-livekit');
  const provider = await createLiveKitRTCProvider({
    roomOptions: instantRoomOptions(options.roomOptions),
  });
  const room = provider.getNativeRoom?.() as Room;
  if (!room) {
    return { ok: false, reason: 'provider_room_missing' };
  }
  if (options.onDisconnected) {
    room.on(RoomEvent.Disconnected, options.onDisconnected);
  }

  const timeoutMs = options.timeoutMs ?? NET_API_FAST_MS;
  try {
    await withTimeout(
      provider.connect({
        roomName: options.roomName || 'instant',
        url: options.url,
        token: options.token,
      }),
      timeoutMs,
      'livekit.connect',
    );
    if (options.connectOptions) {
      // connectOptions applied at Room.connect inside adapter when supported; retained for API compat
      void options.connectOptions;
    }
    return { ok: true, room };
  } catch (err) {
    try {
      room.removeAllListeners();
      await provider.disconnect();
    } catch {
      /* ignore */
    }
    const reason = err instanceof Error ? err.message : 'connect_failed';
    return { ok: false, reason };
  }
}

/** Fetch token + connect in one timed step. */
export async function connectWithTokenFetcher(
  fetchToken: () => Promise<{ token: string; url: string }>,
  options?: {
    timeoutMs?: number;
    roomOptions?: RoomOptions;
    onDisconnected?: () => void;
  },
): Promise<LiveKitConnectResult> {
  if (!canAttemptLiveKit()) {
    return { ok: false, reason: 'offline_or_unconfigured' };
  }
  const timeoutMs = options?.timeoutMs ?? NET_API_FAST_MS;
  try {
    const { token, url } = await withTimeout(fetchToken(), timeoutMs, 'livekit.token');
    return connectLiveKitRoom({
      token,
      url,
      timeoutMs,
      roomOptions: options?.roomOptions,
      onDisconnected: options?.onDisconnected,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'token_failed';
    return { ok: false, reason };
  }
}
