import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

const DEFAULT_TOKEN_TTL = process.env.LIVEKIT_TOKEN_TTL || '10m';

export function isLiveKitConfigured() {
  return Boolean(
    process.env.LIVEKIT_API_KEY?.trim() &&
      process.env.LIVEKIT_API_SECRET?.trim() &&
      getLiveKitUrl(),
  );
}

export function getLiveKitUrl() {
  return (process.env.LIVEKIT_URL || process.env.VITE_LIVEKIT_URL || '').trim();
}

export function streamRoomName(streamId) {
  return `ic-stream-${streamId}`;
}

export function partyRoomName(roomId) {
  return `ic-party-${roomId}`;
}

export function getRoomService() {
  if (!isLiveKitConfigured()) return null;
  return new RoomServiceClient(
    getLiveKitUrl(),
    process.env.LIVEKIT_API_KEY.trim(),
    process.env.LIVEKIT_API_SECRET.trim(),
  );
}

export async function createLiveKitToken({
  identity,
  name,
  room,
  role = 'viewer',
  canPublish,
}) {
  if (!isLiveKitConfigured()) {
    throw new Error('livekit_not_configured');
  }
  const apiKey = process.env.LIVEKIT_API_KEY.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET.trim();
  const publish = canPublish ?? role === 'host';
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: name || identity,
    ttl: DEFAULT_TOKEN_TTL,
  });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: publish,
    canSubscribe: true,
    canPublishData: true,
  });
  return at.toJwt();
}

export async function ensureLiveKitRoom(roomName) {
  const svc = getRoomService();
  if (!svc) return false;
  const existing = await svc.listRooms([roomName]);
  if (existing?.length) return true;
  await svc.createRoom({
    name: roomName,
    emptyTimeout: 300,
    maxParticipants: 50,
  });
  return true;
}

export async function deleteLiveKitRoom(roomName) {
  const svc = getRoomService();
  if (!svc) return false;
  try {
    await svc.deleteRoom(roomName);
    return true;
  } catch {
    return false;
  }
}

export async function removeLiveKitParticipant(roomName, identity) {
  const svc = getRoomService();
  if (!svc || !roomName || !identity) return false;
  try {
    await svc.removeParticipant(roomName, identity);
    return true;
  } catch {
    return false;
  }
}

export async function removeLiveKitParticipantFromAllRooms(identity) {
  const svc = getRoomService();
  const result = {
    roomsChecked: 0,
    participantsRemoved: 0,
    failures: [],
  };
  if (!svc || !identity) return result;

  const rooms = await svc.listRooms();
  for (const room of rooms ?? []) {
    const roomName = room?.name;
    if (!roomName) continue;
    result.roomsChecked += 1;
    try {
      const participants = await svc.listParticipants(roomName);
      if (participants?.some((participant) => participant.identity === identity)) {
        await svc.removeParticipant(roomName, identity);
        result.participantsRemoved += 1;
      }
    } catch {
      result.failures.push(roomName);
    }
  }
  return result;
}

export async function pingLiveKit() {
  if (!isLiveKitConfigured()) return { ok: false, reason: 'not_configured' };
  try {
    const svc = getRoomService();
    await svc.listRooms();
    return { ok: true, url: getLiveKitUrl() };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
