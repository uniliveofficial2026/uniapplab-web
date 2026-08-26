/**
 * Publish processed camera tracks to LiveKit (Tencent WebAR + DeepAR canvas).
 *
 * TRTC equivalent: trtc.updateLocalVideo({ option: { videoTrack } })
 * LiveKit equivalent: localVideoTrack.replaceTrack(track) / publishTrack(track)
 */
import {
  LocalVideoTrack,
  Track,
  type LocalParticipant,
  type TrackPublishOptions,
} from '../rtc/livekitCompatibilityBoundary';
import { WEBAR_OUTPUT_FPS } from '../webar/webarCameraConfig';
import { resolveLiveKitVideoPublishOptions } from '../rtc/liveKitPublishProfile';
import { diagnoseVideoTrack, emitCameraSwitchTrace } from '../camera/cameraSwitchTrace';

export const PROCESSED_VIDEO_LIVEKIT_PUBLISH: TrackPublishOptions = {
  source: Track.Source.Camera,
  simulcast: false,
  videoEncoding: {
    maxBitrate: 1_500_000,
    maxFramerate: WEBAR_OUTPUT_FPS,
  },
  degradationPreference: 'maintain-framerate',
};

/** @deprecated use PROCESSED_VIDEO_LIVEKIT_PUBLISH */
export const TENCENT_BEAUTY_LIVEKIT_PUBLISH = PROCESSED_VIDEO_LIVEKIT_PUBLISH;

export function prepareProcessedVideoTrackForLiveKit(track: MediaStreamTrack): MediaStreamTrack {
  track.contentHint = 'motion';
  return track;
}

export function outputStreamVideoTrack(output: MediaStream | null | undefined): MediaStreamTrack | null {
  return output?.getVideoTracks()[0] ?? null;
}

export type LiveKitVideoUpdateResult = 'replaced' | 'published' | 'unpublished' | 'skipped';

export async function updateLiveKitLocalVideoTrack(
  participant: LocalParticipant,
  track: MediaStreamTrack | null,
  options?: TrackPublishOptions,
): Promise<LiveKitVideoUpdateResult> {
  const publication = participant.getTrackPublication(Track.Source.Camera);
  const localTrack = publication?.track;
  // Capability-driven profile when caller does not pass explicit options.
  const publishOptions = options ?? resolveLiveKitVideoPublishOptions();

  if (!track) {
    if (localTrack) {
      await participant.unpublishTrack(localTrack);
      return 'unpublished';
    }
    return 'skipped';
  }

  const prepared = prepareProcessedVideoTrackForLiveKit(track);

  if (localTrack instanceof LocalVideoTrack) {
    if (localTrack.mediaStreamTrack?.id === prepared.id) {
      return 'skipped';
    }
    emitCameraSwitchTrace('CAMERA_RTC_REPLACE_START', {
      from: diagnoseVideoTrack(localTrack.mediaStreamTrack),
      to: diagnoseVideoTrack(prepared),
    });
    try {
      await localTrack.replaceTrack(prepared, true);
      emitCameraSwitchTrace('CAMERA_RTC_REPLACE_OK', {
        track: diagnoseVideoTrack(prepared),
      });
      return 'replaced';
    } catch (err) {
      emitCameraSwitchTrace('CAMERA_RTC_REPLACE_FAIL', {
        message: err instanceof Error ? err.message.slice(0, 120) : 'unknown',
      });
      throw err;
    }
  }

  await participant.publishTrack(prepared, publishOptions);
  emitCameraSwitchTrace('CAMERA_RTC_REPLACE_OK', {
    track: diagnoseVideoTrack(prepared),
    mode: 'published',
  });
  return 'published';
}
