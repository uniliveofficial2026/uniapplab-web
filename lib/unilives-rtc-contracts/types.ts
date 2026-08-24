export type CanonicalUserId = string;
export type DeviceId = string;
export type AppSessionId = string;
export type RtcRoomSessionId = string;
export type RtcParticipantSessionId = string;
export type RtcTrackId = string;

export type UniLiveRoomType =
  | 'LIVE'
  | 'SHOP_LIVE'
  | 'AUDIO_LIVE'
  | 'MULTI_GUEST'
  | 'PK'
  | 'CALL_1_TO_1'
  | 'CALL_GROUP';

export type CallDomainState =
  | 'CREATED'
  | 'RINGING'
  | 'ACCEPTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'ENDED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'BUSY'
  | 'TIMED_OUT'
  | 'MISSED'
  | 'FAILED';

export type QoeState = 'GOOD' | 'DEGRADING' | 'POOR' | 'CRITICAL' | 'RECOVERING';
export type RtcConnectionState = 'CONNECTED' | 'DEGRADED' | 'RECONNECTING' | 'RECOVERED' | 'FAILED';
export type PublishProfile = 'LOW' | 'STANDARD' | 'HIGH' | 'PREMIUM';
export type SubscriptionProfile =
  | 'FULLSCREEN_HOST'
  | 'PK_LARGE_TILE'
  | 'PK_SMALL_TILE'
  | 'MULTIGUEST_TILE'
  | 'AUDIO_ONLY'
  | 'BACKGROUND';
export type EventClass =
  | 'DURABLE_STATE'
  | 'REALTIME_STATE'
  | 'AUTHORITATIVE_EVENT'
  | 'EPHEMERAL_EVENT'
  | 'ACTIVE_FX';
export type EventLane = 'RELIABLE_CONTROL' | 'LOSS_TOLERANT' | 'SERVER_AUTHORITATIVE';
export type RtcRole = 'host' | 'cohost' | 'guest' | 'viewer' | 'caller' | 'callee';

export interface RtcPermissions {
  canPublishAudio: boolean;
  canPublishVideo: boolean;
  canPublishData: boolean;
  canSubscribe: boolean;
  canAdmin: boolean;
}

export interface RtcGrant {
  grantId: string;
  roomId: string;
  roomSessionId: string;
  canonicalUserId: string;
  role: RtcRole;
  permissions: RtcPermissions;
  expiresAt: string;
}

export interface UniLiveEventEnvelope {
  eventId: string;
  eventType: string;
  schemaVersion: number;
  occurredAt: string;
  receivedAt?: string;
  canonicalUserId?: string;
  roomId?: string;
  rtcParticipantSessionId?: string;
  sequence?: number;
  expiresAt?: string;
  replayPolicy?: 'once' | 'until_expiry' | 'none';
  lane: EventLane;
  eventClass: EventClass;
  properties?: Record<string, unknown>;
}

export interface RtcTrackRef {
  trackId: string;
  kind: 'audio' | 'video';
  source: 'camera' | 'microphone' | 'screen' | 'custom';
  muted: boolean;
}

export interface RtcParticipant {
  participantSessionId: string;
  canonicalUserId: string;
  providerIdentity: string;
  role: RtcRole;
}

export interface RtcSession {
  roomSessionId: string;
  roomId: string;
  roomType: UniLiveRoomType;
  connectionState: RtcConnectionState;
  participants: RtcParticipant[];
}

export interface RtcStats {
  bitrateUp?: number | null;
  bitrateDown?: number | null;
  packetLoss?: number | null;
  rttMs?: number | null;
  jitterMs?: number | null;
  fps?: number | null;
  width?: number | null;
  height?: number | null;
  qualityLimitation?: string | null;
}

export interface UniLivesRTCProvider {
  connect(input: { roomName: string; token: string; url: string }): Promise<void>;
  disconnect(): Promise<void>;
  joinRoom(input: { roomName: string; token: string; url: string }): Promise<RtcSession>;
  leaveRoom(): Promise<void>;
  publishCamera(track: { id?: string; muted?: boolean }): Promise<RtcTrackRef>;
  publishMicrophone(track: { id?: string; muted?: boolean }): Promise<RtcTrackRef>;
  replaceVideoTrack(track: { id?: string; muted?: boolean }): Promise<void>;
  replaceAudioTrack(track: { id?: string; muted?: boolean }): Promise<void>;
  unpublish(trackId: string): Promise<void>;
  setPublishProfile(profile: PublishProfile): Promise<void>;
  setSubscriptionProfile(profile: SubscriptionProfile): Promise<void>;
  sendReliableData(payload: Uint8Array | string, topic?: string): Promise<void>;
  sendLossTolerantData(payload: Uint8Array | string, topic?: string): Promise<void>;
  getStats(): Promise<RtcStats>;
  getConnectionState(): RtcConnectionState;
  on(event: string, handler: (...args: any[]) => void): () => void;
}
