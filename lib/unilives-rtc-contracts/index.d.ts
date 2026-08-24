import type {
  CallDomainState,
  EventLane,
  PublishProfile,
  QoeState,
  RtcConnectionState,
  RtcGrant,
  RtcPermissions,
  RtcRole,
  RtcSession,
  RtcStats,
  RtcTrackRef,
  SubscriptionProfile,
  UniLiveEventEnvelope,
  UniLiveRoomType,
  UniLivesRTCProvider,
} from './types';

export const ROOM_TYPES: readonly UniLiveRoomType[];
export const CALL_STATES: readonly CallDomainState[];
export const QOE_STATES: readonly QoeState[];
export const EVENT_LANES: readonly EventLane[];
export const PUBLISH_PROFILES: readonly PublishProfile[];

export function asCanonicalUserId(id: string): string;
export function asRtcRoomSessionId(id: string): string;
export function permissionsForRole(role: RtcRole): RtcPermissions;

export type {
  CallDomainState,
  EventLane,
  PublishProfile,
  QoeState,
  RtcConnectionState,
  RtcGrant,
  RtcPermissions,
  RtcRole,
  RtcSession,
  RtcStats,
  RtcTrackRef,
  SubscriptionProfile,
  UniLiveEventEnvelope,
  UniLiveRoomType,
  UniLivesRTCProvider,
};
