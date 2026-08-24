/**
 * Single LiveKit Room for a host media session.
 * Presentation must not construct Room instances.
 */

import { ConnectionState, Room } from '../rtc/livekitCompatibilityBoundary';
import { instantRoomOptions } from './liveKitInstant';
import { unregisterLiveKitRoom } from './liveRoomBus';
import { markHostMediaTrace } from '../camera/hostMediaTrace';

export type HostLiveKitAuth = {
  token: string;
  url: string;
};

type HostLiveKitSession = {
  key: string;
  room: Room;
  auth?: HostLiveKitAuth;
  authPromise?: Promise<HostLiveKitAuth>;
  connectPromise?: Promise<Room>;
  prepared: boolean;
};

let active: HostLiveKitSession | null = null;

export function getActiveHostLiveKitRoomKey(): string | null {
  return active?.key ?? null;
}

export function getActiveHostLiveKitRoom(sessionKey?: string): Room | null {
  if (!active) return null;
  if (sessionKey && active.key !== sessionKey.trim()) return null;
  return active.room;
}

export function getOrCreateHostLiveKitRoom(sessionKey: string): Room {
  const key = sessionKey.trim();
  if (active?.key === key) return active.room;
  void disposeHostLiveKitRoom();
  const room = new Room(instantRoomOptions());
  active = { key, room, prepared: false };
  return room;
}

export function invalidateHostLiveKitAuth(sessionKey?: string): void {
  if (!active) return;
  if (sessionKey && active.key !== sessionKey) return;
  active.auth = undefined;
  active.authPromise = undefined;
  active.prepared = false;
  active.connectPromise = undefined;
}

export function prefetchHostLiveKitAuth(
  sessionKey: string,
  fetchToken: () => Promise<HostLiveKitAuth>,
): Promise<HostLiveKitAuth> {
  const session = ensureSession(sessionKey);
  if (session.auth) return Promise.resolve(session.auth);
  if (!session.authPromise) {
    markHostMediaTrace('token_request_started');
    session.authPromise = fetchToken()
      .then((auth) => {
        if (active?.key === sessionKey) {
          active.auth = auth;
          markHostMediaTrace('token_received');
        }
        return auth;
      })
      .catch((err) => {
        if (active?.key === sessionKey) active.authPromise = undefined;
        throw err;
      });
  }
  return session.authPromise;
}

export async function prepareHostLiveKitConnection(
  sessionKey: string,
  fetchToken: () => Promise<HostLiveKitAuth>,
): Promise<void> {
  const session = ensureSession(sessionKey);
  if (session.prepared && session.auth) return;
  const auth = await prefetchHostLiveKitAuth(sessionKey, fetchToken);
  if (active?.key !== sessionKey) return;
  if (session.prepared) return;
  const prepare = session.room.prepareConnection?.bind(session.room);
  if (typeof prepare === 'function') {
    markHostMediaTrace('prepare_connection_started');
    await prepare(auth.url, auth.token);
    if (active?.key !== sessionKey) return;
    markHostMediaTrace('prepare_connection_completed');
  }
  session.prepared = true;
}

export async function connectHostLiveKitRoom(
  sessionKey: string,
  fetchToken: () => Promise<HostLiveKitAuth>,
): Promise<Room> {
  const session = ensureSession(sessionKey);
  if (session.room.state === ConnectionState.Connected) return session.room;
  if (session.connectPromise) return session.connectPromise;

  session.connectPromise = (async () => {
    await prepareHostLiveKitConnection(sessionKey, fetchToken);
    if (active?.key !== sessionKey) throw new Error('host_livekit_session_replaced');
    if (session.room.state === ConnectionState.Connected) return session.room;
    const auth = session.auth ?? (await prefetchHostLiveKitAuth(sessionKey, fetchToken));
    markHostMediaTrace('room_connect_started');
    await session.room.connect(auth.url, auth.token);
    if (active?.key !== sessionKey) throw new Error('host_livekit_session_replaced');
    markHostMediaTrace('room_connected');
    return session.room;
  })();

  try {
    return await session.connectPromise;
  } catch (err) {
    if (active?.connectPromise === session.connectPromise) {
      active.connectPromise = undefined;
    }
    throw err;
  }
}

export async function reconnectHostLiveKitWithNewGrants(
  sessionKey: string,
  fetchToken: () => Promise<HostLiveKitAuth>,
): Promise<Room> {
  invalidateHostLiveKitAuth(sessionKey);
  const session = ensureSession(sessionKey);
  if (session.room.state !== ConnectionState.Disconnected) {
    try {
      await session.room.disconnect();
    } catch {
      /* continue reconnect */
    }
  }
  session.connectPromise = undefined;
  session.prepared = false;
  return connectHostLiveKitRoom(sessionKey, fetchToken);
}

export async function disposeHostLiveKitRoom(sessionKey?: string): Promise<void> {
  if (!active) return;
  if (sessionKey && active.key !== sessionKey) return;
  const { room, key } = active;
  active = null;
  unregisterLiveKitRoom(key, room);
  try {
    room.removeAllListeners();
    await room.disconnect();
  } catch {
    /* ignore */
  }
}

function ensureSession(sessionKey: string): HostLiveKitSession {
  getOrCreateHostLiveKitRoom(sessionKey);
  if (!active || active.key !== sessionKey) {
    throw new Error('host_livekit_session_missing');
  }
  return active;
}
