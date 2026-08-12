/**
 * Instant LiveKit for calls, live, party, multi-guest:
 * - UI (avatars/posters/local camera) paints first
 * - Connect is background with short timeout
 * - Slow/offline: local UI keeps working; A/V upgrades when ready
 */
import {
  Room,
  RoomEvent,
  type RoomOptions,
  type RoomConnectOptions,
} from 'livekit-client';
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
    // Prefer smoother recovery on flaky links.
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
  timeoutMs?: number;
  roomOptions?: RoomOptions;
  connectOptions?: RoomConnectOptions;
  onDisconnected?: () => void;
}): Promise<LiveKitConnectResult> {
  if (!canAttemptLiveKit()) {
    return { ok: false, reason: 'offline_or_unconfigured' };
  }

  const room = new Room(instantRoomOptions(options.roomOptions));
  if (options.onDisconnected) {
    room.on(RoomEvent.Disconnected, options.onDisconnected);
  }

  const timeoutMs = options.timeoutMs ?? NET_API_FAST_MS;
  try {
    await withTimeout(
      room.connect(options.url, options.token, options.connectOptions),
      timeoutMs,
      'livekit.connect',
    );
    return { ok: true, room };
  } catch (err) {
    try {
      room.removeAllListeners();
      await room.disconnect();
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
