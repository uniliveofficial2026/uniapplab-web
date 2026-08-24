import { permissionsForRole } from '@unilives/rtc-contracts';

/**
 * Mint a UniLive RTC grant from authenticated business authorization.
 * Clients cannot self-grant host/publisher privileges.
 * @param {{
 *   canonicalUserId: string,
 *   roomId: string,
 *   role: import('@unilives/rtc-contracts').RtcRole,
 *   roomSessionId?: string,
 *   ttlSec?: number,
 * }} input
 */
export function createRtcGrant(input) {
  const ttlSec = Math.max(60, Math.min(6 * 3600, Number(input.ttlSec) || 3600));
  const permissions = permissionsForRole(input.role);
  return {
    grantId: `grant_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    roomId: String(input.roomId || '').trim(),
    roomSessionId: String(input.roomSessionId || input.roomId || '').trim(),
    canonicalUserId: String(input.canonicalUserId || '').trim(),
    role: input.role,
    permissions,
    expiresAt: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
}

/**
 * Map UniLive grant → LiveKit JWT via existing @workspace/livekit (adapter boundary).
 * LiveKit types stay in this server/adapter path only.
 * @param {ReturnType<typeof createRtcGrant>} grant
 * @param {{ roomName?: string, name?: string }} [opts]
 */
export async function mintProviderTokenFromGrant(grant, opts = {}) {
  const { createLiveKitToken, isLiveKitConfigured } = await import('@workspace/livekit');
  if (!isLiveKitConfigured()) {
    throw Object.assign(new Error('livekit_not_configured'), { code: 'PROVIDER_NOT_CONFIGURED' });
  }
  const role = grant.permissions.canAdmin ? 'host' : grant.permissions.canPublishVideo || grant.permissions.canPublishAudio ? 'host' : 'viewer';
  const token = await createLiveKitToken({
    identity: grant.canonicalUserId,
    name: opts.name || grant.canonicalUserId,
    room: opts.roomName || grant.roomId,
    role,
    canPublish: grant.permissions.canPublishAudio || grant.permissions.canPublishVideo,
  });
  return {
    provider: 'livekit',
    token,
    grant,
  };
}

/**
 * Normalize provider webhooks into UniLive events (idempotent by providerEventId).
 * @param {{ provider: string, providerEventId: string, type: string, roomId?: string, participantIdentity?: string, occurredAt?: string }} input
 */
export function normalizeProviderWebhook(input) {
  const map = {
    room_started: 'RTCRoomStarted',
    room_finished: 'RTCRoomEnded',
    participant_joined: 'RTCParticipantJoined',
    participant_left: 'RTCParticipantLeft',
    track_published: 'RTCTrackPublished',
    track_unpublished: 'RTCTrackUnpublished',
  };
  const eventType = map[input.type] || `RTCProvider.${input.type}`;
  return {
    eventId: `${input.provider}:${input.providerEventId}`,
    eventType,
    schemaVersion: 1,
    occurredAt: input.occurredAt || new Date().toISOString(),
    roomId: input.roomId,
    canonicalUserId: input.participantIdentity,
    lane: 'SERVER_AUTHORITATIVE',
    eventClass: 'AUTHORITATIVE_EVENT',
    properties: {
      provider: input.provider,
      providerEventId: input.providerEventId,
    },
  };
}
