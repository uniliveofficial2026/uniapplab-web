/**
 * Safe DEBUG camera-switch trace — track/device metadata only.
 * No tokens, frames, or personal content.
 */

export type CameraSwitchTraceStep =
  | 'CAMERA_SWITCH_TAP'
  | 'CAMERA_SWITCH_REQUEST_FRONT'
  | 'CAMERA_SWITCH_REQUEST_REAR'
  | 'CAMERA_CURRENT_TRACK_BEFORE'
  | 'CAMERA_GET_USER_MEDIA_START'
  | 'CAMERA_GET_USER_MEDIA_OK'
  | 'CAMERA_GET_USER_MEDIA_FAIL'
  | 'CAMERA_NEW_TRACK_SETTINGS'
  | 'CAMERA_PREVIEW_REPLACED'
  | 'CAMERA_RENDER_GRAPH_REPLACED'
  | 'CAMERA_RTC_REPLACE_START'
  | 'CAMERA_RTC_REPLACE_OK'
  | 'CAMERA_RTC_REPLACE_FAIL'
  | 'CAMERA_OLD_TRACK_STOPPED'
  | 'CAMERA_SWITCH_COMPLETE'
  | 'CAMERA_SWITCH_ERROR'
  | 'CAMERA_PIPELINE_CORRELATION'
  | 'CAMERA_GENERATION_BUMP';

export type CameraTrackDiag = {
  trackIdHash: string;
  readyState?: string;
  enabled?: boolean;
  muted?: boolean;
  facingMode?: string;
  width?: number;
  height?: number;
  frameRate?: number;
  aspectRatio?: number;
  deviceIdHash?: string;
  groupIdHash?: string;
};

export type CameraPipelineCorrelation = {
  cameraGeneration: number;
  requestedFacing?: string;
  actualFacing?: string;
  sourceTrackIdHash?: string;
  renderInputTrackIdHash?: string;
  renderOutputTrackIdHash?: string;
  rtcSenderTrackIdHash?: string;
  liveKitPublicationSid?: string;
  liveKitParticipantIdentityHash?: string;
  roomIdHash?: string;
  canonicalPersonIdHash?: string;
  switching?: boolean;
  at: number;
};

type CameraDebugWindow = Window & {
  __UNILIVE_CAMERA_SWITCH_DEBUG__?: unknown;
  __UNILIVE_CAMERA_PIPELINE__?: CameraPipelineCorrelation;
  __UNILIVE_CAMERA_SWITCH_HISTORY__?: unknown[];
};

/** Monotonic source generation — bumps only after a successful physical facing transition. */
let cameraGeneration = 0;
let switching = false;
let lastCorrelation: CameraPipelineCorrelation = {
  cameraGeneration: 0,
  at: 0,
};

export function hashId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `h${(h >>> 0).toString(16).padStart(8, '0')}`;
}

export function getCameraGeneration(): number {
  return cameraGeneration;
}

export function bumpCameraGeneration(reason?: string): number {
  cameraGeneration += 1;
  emitCameraSwitchTrace('CAMERA_GENERATION_BUMP', {
    cameraGeneration,
    reason: reason?.slice(0, 80),
  });
  return cameraGeneration;
}

export function setCameraSwitching(next: boolean): void {
  switching = next;
  publishPipelineCorrelation({ switching: next });
}

export function diagnoseVideoTrack(track: MediaStreamTrack | null | undefined): CameraTrackDiag | null {
  if (!track) return null;
  let settings: MediaTrackSettings = {};
  try {
    settings = track.getSettings?.() ?? {};
  } catch {
    /* ignore */
  }
  return {
    trackIdHash: hashId(track.id) ?? 'h00000000',
    readyState: track.readyState,
    enabled: track.enabled,
    muted: track.muted,
    facingMode: typeof settings.facingMode === 'string' ? settings.facingMode : undefined,
    width: typeof settings.width === 'number' ? settings.width : undefined,
    height: typeof settings.height === 'number' ? settings.height : undefined,
    frameRate: typeof settings.frameRate === 'number' ? settings.frameRate : undefined,
    aspectRatio: typeof settings.aspectRatio === 'number' ? settings.aspectRatio : undefined,
    deviceIdHash: hashId(settings.deviceId),
    groupIdHash: hashId(settings.groupId),
  };
}

export function publishPipelineCorrelation(
  partial: Partial<Omit<CameraPipelineCorrelation, 'at' | 'cameraGeneration'>> & {
    cameraGeneration?: number;
  } = {},
): CameraPipelineCorrelation {
  lastCorrelation = {
    ...lastCorrelation,
    ...partial,
    cameraGeneration: partial.cameraGeneration ?? cameraGeneration,
    switching: partial.switching ?? switching,
    at: Date.now(),
  };
  if (typeof window === 'undefined') return lastCorrelation;
  try {
    const w = window as CameraDebugWindow;
    w.__UNILIVE_CAMERA_PIPELINE__ = lastCorrelation;
  } catch {
    /* ignore */
  }
  emitCameraSwitchTrace('CAMERA_PIPELINE_CORRELATION', { ...lastCorrelation });
  return lastCorrelation;
}

export function getCameraPipelineCorrelation(): CameraPipelineCorrelation {
  return lastCorrelation;
}

export function emitCameraSwitchTrace(
  step: CameraSwitchTraceStep,
  detail?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = {
      step,
      at: Date.now(),
      cameraGeneration,
      ...detail,
    };
    const w = window as CameraDebugWindow;
    w.__UNILIVE_CAMERA_SWITCH_DEBUG__ = payload;
    const hist = Array.isArray(w.__UNILIVE_CAMERA_SWITCH_HISTORY__)
      ? w.__UNILIVE_CAMERA_SWITCH_HISTORY__
      : [];
    hist.push(payload);
    while (hist.length > 40) hist.shift();
    w.__UNILIVE_CAMERA_SWITCH_HISTORY__ = hist;
    console.info('[CameraSwitch]', step, detail ?? {});
  } catch {
    /* ignore */
  }
}

/** Masked enumerateDevices summary for QA — never log raw deviceId. */
export async function summarizeVideoInputs(): Promise<
  Array<{ index: number; labelKind: string; deviceIdHash?: string; groupIdHash?: string }>
> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'videoinput')
      .map((d, index) => {
        const label = (d.label || '').toLowerCase();
        let labelKind = 'unknown';
        if (/front|user|facetime|selfie|true.?depth/.test(label)) labelKind = 'frontish';
        else if (/back|rear|environment|wide|ultra|tele/.test(label)) labelKind = 'rearish';
        else if (label) labelKind = 'labeled';
        return {
          index,
          labelKind,
          deviceIdHash: hashId(d.deviceId),
          groupIdHash: hashId(d.groupId),
        };
      });
  } catch {
    return [];
  }
}
