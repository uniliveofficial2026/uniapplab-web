/**
 * Capability-driven LiveKit video publish profile.
 * Never blindly enable expensive simulcast on every device.
 */

import { Track, type TrackPublishOptions, VideoPresets } from './livekitCompatibilityBoundary';
import { WEBAR_OUTPUT_FPS } from '../webar/webarCameraConfig';
import { getThermalPolicy } from '../performance/thermalGovernor';
import { getNetworkQoEPolicy } from './networkQoEGovernor';
import type { RoomTopology } from './roomTopologyPolicy';

export type PublishCapabilityInput = {
  topology?: RoomTopology;
  /** Device class hint from UA / memory */
  deviceClass?: 'low' | 'mid' | 'high';
  forceSimulcast?: boolean;
  forceDisableSimulcast?: boolean;
};

function inferDeviceClass(): 'low' | 'mid' | 'high' {
  try {
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (typeof mem === 'number') {
      if (mem <= 2) return 'low';
      if (mem <= 4) return 'mid';
    }
    const cores = navigator.hardwareConcurrency ?? 4;
    if (cores <= 4) return 'low';
    if (cores <= 6) return 'mid';
  } catch {
    /* ignore */
  }
  return 'high';
}

/**
 * Build publish options for processed camera tracks.
 * Simulcast only when thermal + network + device allow it.
 */
export function resolveLiveKitVideoPublishOptions(
  input: PublishCapabilityInput = {},
): TrackPublishOptions {
  const thermal = getThermalPolicy();
  const qoe = getNetworkQoEPolicy();
  const device = input.deviceClass ?? inferDeviceClass();

  const allowSimulcast =
    input.forceDisableSimulcast === true
      ? false
      : input.forceSimulcast === true
        ? true
        : qoe.allowSimulcast &&
          thermal.fxBudget >= 0.55 &&
          device !== 'low' &&
          input.topology !== 'CALL_1TO1';

  const prefer30 =
    thermal.preferStable30Fps || qoe.preferStable30Fps || device === 'low';
  const fps = prefer30 ? Math.min(30, WEBAR_OUTPUT_FPS) : WEBAR_OUTPUT_FPS;
  const maxBitrate =
    qoe.publishAggressiveness >= 0.85
      ? 1_500_000
      : qoe.publishAggressiveness >= 0.55
        ? 1_000_000
        : 600_000;

  const options: TrackPublishOptions = {
    source: Track.Source.Camera,
    simulcast: allowSimulcast,
    videoEncoding: {
      maxBitrate,
      maxFramerate: fps,
    },
    degradationPreference: prefer30 ? 'maintain-framerate' : 'balanced',
  };

  if (allowSimulcast) {
    options.videoSimulcastLayers = [VideoPresets.h180, VideoPresets.h360];
  }

  return options;
}

/** Default processed-video publish — capability evaluated at call time when using resolver. */
export const PROCESSED_VIDEO_LIVEKIT_PUBLISH: TrackPublishOptions = {
  source: Track.Source.Camera,
  simulcast: false,
  videoEncoding: {
    maxBitrate: 1_500_000,
    maxFramerate: WEBAR_OUTPUT_FPS,
  },
  degradationPreference: 'maintain-framerate',
};
