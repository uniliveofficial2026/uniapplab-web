/**
 * DOCUMENTED LiveKit compatibility boundary for Stage B migration.
 *
 * Direct `livekit-client` imports MUST live only here (or in `@unilives/rtc-livekit`).
 * Feature modules import types/helpers from this file while media joins migrate to UniLiveRTC.
 *
 * Target end-state: delete this file once all attach/publish paths use `@unilives/rtc-livekit`.
 */
export {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  ConnectionQuality,
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteTrack,
  VideoPresets,
} from 'livekit-client';

export type {
  RemoteParticipant,
  RemoteTrackPublication,
  LocalParticipant,
  TrackPublishOptions,
  RoomOptions,
  RoomConnectOptions,
} from 'livekit-client';

/** Re-export namespace for lazy loaders that previously did `import('livekit-client')`. */
export async function loadLiveKitClient() {
  return import('livekit-client');
}
