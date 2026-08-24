/**
 * @unilives/rtc-contracts — provider-neutral UniLiveRTC types.
 * LiveKit types must NOT leak through this public surface.
 */

/** @typedef {string & { readonly __brand: 'CanonicalUserId' }} CanonicalUserId */
/** @typedef {string & { readonly __brand: 'DeviceId' }} DeviceId */
/** @typedef {string & { readonly __brand: 'AppSessionId' }} AppSessionId */
/** @typedef {string & { readonly __brand: 'RtcRoomSessionId' }} RtcRoomSessionId */
/** @typedef {string & { readonly __brand: 'RtcParticipantSessionId' }} RtcParticipantSessionId */
/** @typedef {string & { readonly __brand: 'RtcTrackId' }} RtcTrackId */

/**
 * @typedef {'LIVE'|'SHOP_LIVE'|'AUDIO_LIVE'|'MULTI_GUEST'|'PK'|'CALL_1_TO_1'|'CALL_GROUP'} UniLiveRoomType
 */

/**
 * @typedef {'CREATED'|'RINGING'|'ACCEPTED'|'CONNECTING'|'CONNECTED'|'RECONNECTING'|'ENDED'|'DECLINED'|'CANCELLED'|'BUSY'|'TIMED_OUT'|'MISSED'|'FAILED'} CallDomainState
 */

/**
 * @typedef {'GOOD'|'DEGRADING'|'POOR'|'CRITICAL'|'RECOVERING'} QoeState
 */

/**
 * @typedef {'CONNECTED'|'DEGRADED'|'RECONNECTING'|'RECOVERED'|'FAILED'} RtcConnectionState
 */

/**
 * @typedef {'LOW'|'STANDARD'|'HIGH'|'PREMIUM'} PublishProfile
 */

/**
 * @typedef {'FULLSCREEN_HOST'|'PK_LARGE_TILE'|'PK_SMALL_TILE'|'MULTIGUEST_TILE'|'AUDIO_ONLY'|'BACKGROUND'} SubscriptionProfile
 */

/**
 * @typedef {'DURABLE_STATE'|'REALTIME_STATE'|'AUTHORITATIVE_EVENT'|'EPHEMERAL_EVENT'|'ACTIVE_FX'} EventClass
 */

/**
 * @typedef {'RELIABLE_CONTROL'|'LOSS_TOLERANT'|'SERVER_AUTHORITATIVE'} EventLane
 */

/**
 * @typedef {'host'|'cohost'|'guest'|'viewer'|'caller'|'callee'} RtcRole
 */

/**
 * @typedef {{
 *   canPublishAudio: boolean,
 *   canPublishVideo: boolean,
 *   canPublishData: boolean,
 *   canSubscribe: boolean,
 *   canAdmin: boolean,
 * }} RtcPermissions
 */

/**
 * @typedef {{
 *   grantId: string,
 *   roomId: string,
 *   roomSessionId: string,
 *   canonicalUserId: string,
 *   role: RtcRole,
 *   permissions: RtcPermissions,
 *   expiresAt: string,
 * }} RtcGrant
 */

/**
 * @typedef {{
 *   eventId: string,
 *   eventType: string,
 *   schemaVersion: number,
 *   occurredAt: string,
 *   receivedAt?: string,
 *   canonicalUserId?: string,
 *   roomId?: string,
 *   rtcParticipantSessionId?: string,
 *   sequence?: number,
 *   expiresAt?: string,
 *   replayPolicy?: 'once'|'until_expiry'|'none',
 *   lane: EventLane,
 *   eventClass: EventClass,
 *   properties?: Record<string, unknown>,
 * }} UniLiveEventEnvelope
 */

/**
 * @typedef {{
 *   trackId: string,
 *   kind: 'audio'|'video',
 *   source: 'camera'|'microphone'|'screen'|'custom',
 *   muted: boolean,
 * }} RtcTrackRef
 */

/**
 * @typedef {{
 *   participantSessionId: string,
 *   canonicalUserId: string,
 *   providerIdentity: string,
 *   role: RtcRole,
 * }} RtcParticipant
 */

/**
 * @typedef {{
 *   roomSessionId: string,
 *   roomId: string,
 *   roomType: UniLiveRoomType,
 *   connectionState: RtcConnectionState,
 *   participants: RtcParticipant[],
 * }} RtcSession
 */

/**
 * @typedef {{
 *   bitrateUp?: number|null,
 *   bitrateDown?: number|null,
 *   packetLoss?: number|null,
 *   rttMs?: number|null,
 *   jitterMs?: number|null,
 *   fps?: number|null,
 *   width?: number|null,
 *   height?: number|null,
 *   qualityLimitation?: string|null,
 * }} RtcStats
 */

/**
 * Provider-neutral RTC adapter. LiveKit types must stay inside the LiveKit adapter package.
 * @typedef {{
 *   connect: (input: { roomName: string, token: string, url: string }) => Promise<void>,
 *   disconnect: () => Promise<void>,
 *   joinRoom: (input: { roomName: string, token: string, url: string }) => Promise<RtcSession>,
 *   leaveRoom: () => Promise<void>,
 *   publishCamera: (track: MediaStreamTrack) => Promise<RtcTrackRef>,
 *   publishMicrophone: (track: MediaStreamTrack) => Promise<RtcTrackRef>,
 *   replaceVideoTrack: (track: MediaStreamTrack) => Promise<void>,
 *   replaceAudioTrack: (track: MediaStreamTrack) => Promise<void>,
 *   unpublish: (trackId: string) => Promise<void>,
 *   setPublishProfile: (profile: PublishProfile) => Promise<void>,
 *   setSubscriptionProfile: (profile: SubscriptionProfile) => Promise<void>,
 *   sendReliableData: (payload: Uint8Array|string, topic?: string) => Promise<void>,
 *   sendLossTolerantData: (payload: Uint8Array|string, topic?: string) => Promise<void>,
 *   getStats: () => Promise<RtcStats>,
 *   getConnectionState: () => RtcConnectionState,
 *   on: (event: string, handler: (...args: any[]) => void) => () => void,
 * }} UniLivesRTCProvider
 */

export const ROOM_TYPES = Object.freeze([
  'LIVE',
  'SHOP_LIVE',
  'AUDIO_LIVE',
  'MULTI_GUEST',
  'PK',
  'CALL_1_TO_1',
  'CALL_GROUP',
]);

export const CALL_STATES = Object.freeze([
  'CREATED',
  'RINGING',
  'ACCEPTED',
  'CONNECTING',
  'CONNECTED',
  'RECONNECTING',
  'ENDED',
  'DECLINED',
  'CANCELLED',
  'BUSY',
  'TIMED_OUT',
  'MISSED',
  'FAILED',
]);

export const QOE_STATES = Object.freeze(['GOOD', 'DEGRADING', 'POOR', 'CRITICAL', 'RECOVERING']);

export const EVENT_LANES = Object.freeze(['RELIABLE_CONTROL', 'LOSS_TOLERANT', 'SERVER_AUTHORITATIVE']);

export const PUBLISH_PROFILES = Object.freeze(['LOW', 'STANDARD', 'HIGH', 'PREMIUM']);

/**
 * @param {string} id
 * @returns {CanonicalUserId}
 */
export function asCanonicalUserId(id) {
  return /** @type {CanonicalUserId} */ (String(id || '').trim());
}

/**
 * Brand helper for room session ids.
 * @param {string} id
 * @returns {RtcRoomSessionId}
 */
export function asRtcRoomSessionId(id) {
  return /** @type {RtcRoomSessionId} */ (String(id || '').trim());
}

/**
 * Default permissions by role.
 * @param {RtcRole} role
 * @returns {RtcPermissions}
 */
export function permissionsForRole(role) {
  switch (role) {
    case 'host':
    case 'cohost':
      return { canPublishAudio: true, canPublishVideo: true, canPublishData: true, canSubscribe: true, canAdmin: true };
    case 'guest':
    case 'caller':
    case 'callee':
      return { canPublishAudio: true, canPublishVideo: true, canPublishData: true, canSubscribe: true, canAdmin: false };
    case 'viewer':
    default:
      return { canPublishAudio: false, canPublishVideo: false, canPublishData: true, canSubscribe: true, canAdmin: false };
  }
}
