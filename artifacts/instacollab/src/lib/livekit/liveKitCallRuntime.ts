/**
 * Lazy LiveKit stack for chat calls — never statically imported from App boot.
 * Load only when a call actually connects or publishes video.
 */
import type {
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
} from '../rtc/livekitCompatibilityBoundary';
import type { connectWithTokenFetcher } from './liveKitInstant';
import type {
  PROCESSED_VIDEO_LIVEKIT_PUBLISH,
  prepareProcessedVideoTrackForLiveKit,
  updateLiveKitLocalVideoTrack,
} from './liveKitVideoPublish';

export type LiveKitCallRuntime = {
  RoomEvent: typeof import('../rtc/livekitCompatibilityBoundary').RoomEvent;
  Track: typeof import('../rtc/livekitCompatibilityBoundary').Track;
  canAttemptLiveKit: () => boolean;
  connectWithTokenFetcher: typeof connectWithTokenFetcher;
  PROCESSED_VIDEO_LIVEKIT_PUBLISH: typeof PROCESSED_VIDEO_LIVEKIT_PUBLISH;
  prepareProcessedVideoTrackForLiveKit: typeof prepareProcessedVideoTrackForLiveKit;
  updateLiveKitLocalVideoTrack: typeof updateLiveKitLocalVideoTrack;
};

export type { Room, RemoteTrack, RemoteTrackPublication, RemoteParticipant };

let loadPromise: Promise<LiveKitCallRuntime> | null = null;

export function loadLiveKitCallRuntime(): Promise<LiveKitCallRuntime> {
  if (!loadPromise) {
    loadPromise = Promise.all([
      import('../rtc/livekitCompatibilityBoundary'),
      import('./liveKitInstant'),
      import('./liveKitVideoPublish'),
    ]).then(([lk, instant, publish]) => ({
      RoomEvent: lk.RoomEvent,
      Track: lk.Track,
      canAttemptLiveKit: instant.canAttemptLiveKit,
      connectWithTokenFetcher: instant.connectWithTokenFetcher,
      PROCESSED_VIDEO_LIVEKIT_PUBLISH: publish.PROCESSED_VIDEO_LIVEKIT_PUBLISH,
      prepareProcessedVideoTrackForLiveKit: publish.prepareProcessedVideoTrackForLiveKit,
      updateLiveKitLocalVideoTrack: publish.updateLiveKitLocalVideoTrack,
    }));
  }
  return loadPromise;
}
