/**
 * Camera acquisition — facing-aware getUserMedia with timeout guards.
 *
 * Critical reliability rules:
 * 1. When a facingMode is requested, try that facing FIRST (ideal → exact).
 *    Never prefer bare `{ video: true }` first — on iOS that returns the front
 *    camera and makes rear switch look like a no-op (classification D).
 * 2. Every getUserMedia has a timeout; on TimeoutError we STOP (no cascade).
 * 3. Verify track.getSettings().facingMode when available; retry if mismatch.
 * 4. NotFound often means OS Camera privacy or a brief device-release race.
 */
import { isCameraPermissionError } from './errors';
import { explainInsecureMediaContext } from '../platform/runtime';
import {
  diagnoseVideoTrack,
  emitCameraSwitchTrace,
  summarizeVideoInputs,
} from './cameraSwitchTrace';

export type CameraFacingMode = 'user' | 'environment';

export type OpenCameraMediaOptions = {
  facingMode: CameraFacingMode;
  audio: boolean;
  videoIdeal: { width: number; height: number };
  frameRate?: { ideal?: number; max?: number };
  exactFacing?: boolean;
  /** When true, prefer releasing the previous stream before rear/front GUM (iOS exclusive). */
  releaseBeforeAcquire?: boolean;
  previousStream?: MediaStream | null;
};

export type OpenCameraMediaResult = {
  stream: MediaStream;
  facingMode: CameraFacingMode;
};

const GUM_TIMEOUT_MS = 12_000;

function errName(err: unknown): string {
  return err && typeof err === 'object' && 'name' in err
    ? String((err as { name?: unknown }).name)
    : '';
}

function isNotReadable(err: unknown): boolean {
  const n = errName(err);
  return n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError';
}

function isTimeout(err: unknown): boolean {
  return errName(err) === 'TimeoutError';
}

function isNotFound(err: unknown): boolean {
  const n = errName(err);
  if (n === 'NotFoundError' || n === 'DevicesNotFoundError') return true;
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: unknown }).message)
      : '';
  return /device not found|no device|requested device/i.test(msg);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function browserAppName(): string {
  if (typeof navigator === 'undefined') return 'your browser';
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Microsoft Edge';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Google Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
  return 'this browser';
}

async function queryCameraPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  try {
    const perms = navigator.permissions;
    if (!perms?.query) return 'unknown';
    const status = await perms.query({ name: 'camera' as PermissionName });
    if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
      return status.state;
    }
  } catch {
    /* Safari may throw for camera permission query */
  }
  return 'unknown';
}

async function listVideoInputs(): Promise<MediaDeviceInfo[]> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  } catch {
    return [];
  }
}

function withTimeout(promise: Promise<MediaStream>, ms: number): Promise<MediaStream> {
  return new Promise<MediaStream>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new DOMException('Camera timed out', 'TimeoutError'));
    }, ms);
    promise.then(
      (stream) => {
        if (settled) {
          try {
            stream.getTracks().forEach((t) => t.stop());
          } catch {
            /* ignore */
          }
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(stream);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function hintMotion(stream: MediaStream): MediaStream {
  stream.getVideoTracks().forEach((t) => {
    t.contentHint = 'motion';
  });
  return stream;
}

export function detectFacing(stream: MediaStream, fallback: CameraFacingMode): CameraFacingMode {
  try {
    const f = stream.getVideoTracks()[0]?.getSettings().facingMode;
    if (f === 'user' || f === 'environment') return f;
  } catch {
    /* ignore */
  }
  return fallback;
}

function facingMatches(stream: MediaStream, requested: CameraFacingMode): boolean {
  try {
    const f = stream.getVideoTracks()[0]?.getSettings().facingMode;
    // Some WebKit builds omit facingMode — treat as unknown (accept).
    if (f !== 'user' && f !== 'environment') return true;
    return f === requested;
  } catch {
    return true;
  }
}

async function gum(constraints: MediaStreamConstraints): Promise<MediaStream> {
  emitCameraSwitchTrace('CAMERA_GET_USER_MEDIA_START', {
    hasFacing:
      typeof constraints.video === 'object' &&
      constraints.video !== null &&
      'facingMode' in constraints.video,
    hasDeviceId:
      typeof constraints.video === 'object' &&
      constraints.video !== null &&
      'deviceId' in constraints.video,
    audio: Boolean(constraints.audio),
  });
  try {
    const stream = hintMotion(
      await withTimeout(navigator.mediaDevices.getUserMedia(constraints), GUM_TIMEOUT_MS),
    );
    emitCameraSwitchTrace('CAMERA_GET_USER_MEDIA_OK', {
      track: diagnoseVideoTrack(stream.getVideoTracks()[0]),
    });
    return stream;
  } catch (err) {
    emitCameraSwitchTrace('CAMERA_GET_USER_MEDIA_FAIL', {
      name: errName(err),
      message: err instanceof Error ? err.message.slice(0, 120) : 'unknown',
    });
    throw err;
  }
}

async function upgradeQuality(
  stream: MediaStream,
  videoIdeal: { width: number; height: number },
  frameRate?: { ideal?: number; max?: number },
): Promise<void> {
  const track = stream.getVideoTracks()[0];
  if (!track?.applyConstraints) return;
  try {
    await track.applyConstraints({
      width: { ideal: videoIdeal.width },
      height: { ideal: videoIdeal.height },
      ...(frameRate ? { frameRate } : {}),
    });
  } catch {
    /* keep default */
  }
}

function stopStreamTracks(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  try {
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    /* ignore */
  }
}

function scoreDeviceForFacing(device: MediaDeviceInfo, facing: CameraFacingMode): number {
  const label = (device.label || '').toLowerCase();
  if (facing === 'user') {
    if (/front|user|facetime|selfie|true.?depth/.test(label)) return 0;
    if (/back|rear|environment|ultra|tele|wide/.test(label)) return 5;
    return 2;
  }
  // environment / rear — prefer default wide/back, avoid ultra/tele/macro when possible
  if (/ultra|tele|macro|continuity|virtual|obs|snap|camo/.test(label)) return 4;
  if (/back|rear|environment|wide/.test(label) && !/ultra|tele/.test(label)) return 0;
  if (/back|rear|environment/.test(label)) return 1;
  if (/front|user|facetime|selfie/.test(label)) return 5;
  return 3;
}

async function friendlyFailure(lastErr: unknown): Promise<Error> {
  const app = browserAppName();
  const permission = await queryCameraPermission();
  const inputs = await listVideoInputs();
  const labeled = inputs.filter((d) => d.label || d.deviceId).length;

  if (isTimeout(lastErr)) {
    return new Error(
      `Camera permission timed out. When ${app} asks, tap Allow — then tap Retry.`,
    );
  }
  if (isCameraPermissionError(lastErr) || permission === 'denied') {
    return new Error(
      `Camera is blocked for this site. Click the lock/camera icon in the address bar → Camera → Allow, then tap Retry.`,
    );
  }
  if (isNotReadable(lastErr)) {
    return new Error(
      `Camera is busy. Quit Zoom, FaceTime, Photo Booth, and other ${app} tabs using the camera — then tap Retry.`,
    );
  }
  if (isNotFound(lastErr)) {
    if (permission === 'granted' || labeled > 0) {
      return new Error(
        `Camera is visible but ${app} cannot open it. Quit other apps using the camera, unplug/replug USB cams, then tap Retry.`,
      );
    }
    return new Error(
      `No camera for ${app}. macOS: System Settings → Privacy & Security → Camera → turn ON “${app}” (not only the master switch). Windows: Settings → Privacy → Camera → allow ${app}. Then tap Retry.`,
    );
  }
  if (lastErr instanceof Error && lastErr.message.trim()) return lastErr;
  return new Error('Could not access the camera. Tap Retry.');
}

/**
 * Acquire a camera MediaStream for the requested facing side.
 * Always settles (success or clear Error) — never hangs the app.
 */
export async function openCameraMediaStream(
  opts: OpenCameraMediaOptions,
): Promise<OpenCameraMediaResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera is not supported in this browser.');
  }
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    throw new Error(explainInsecureMediaContext());
  }

  const { facingMode, audio, videoIdeal, frameRate, exactFacing } = opts;

  emitCameraSwitchTrace(
    facingMode === 'environment' ? 'CAMERA_SWITCH_REQUEST_REAR' : 'CAMERA_SWITCH_REQUEST_FRONT',
    {
      exactFacing: Boolean(exactFacing),
      releaseBeforeAcquire: Boolean(opts.releaseBeforeAcquire),
      inputs: await summarizeVideoInputs(),
      previous: diagnoseVideoTrack(opts.previousStream?.getVideoTracks()[0]),
    },
  );

  // iOS often refuses a second physical capture while the first track owns the session.
  if (opts.releaseBeforeAcquire && opts.previousStream) {
    stopStreamTracks(opts.previousStream);
    await sleep(280);
  }

  const finish = async (stream: MediaStream): Promise<OpenCameraMediaResult> => {
    await upgradeQuality(stream, videoIdeal, frameRate);
    const actual = detectFacing(stream, facingMode);
    emitCameraSwitchTrace('CAMERA_NEW_TRACK_SETTINGS', {
      requested: facingMode,
      actual,
      track: diagnoseVideoTrack(stream.getVideoTracks()[0]),
    });
    return { stream, facingMode: actual };
  };

  const accept = async (
    stream: MediaStream,
    opts?: { bareVideo?: boolean },
  ): Promise<OpenCameraMediaResult | null> => {
    const reported = (() => {
      try {
        return stream.getVideoTracks()[0]?.getSettings().facingMode;
      } catch {
        return undefined;
      }
    })();
    // Never accept a known front track when rear was requested (class D).
    if (facingMode === 'environment' && reported === 'user') {
      stopStreamTracks(stream);
      return null;
    }
    if (facingMode === 'user' && reported === 'environment' && (exactFacing || opts?.bareVideo)) {
      stopStreamTracks(stream);
      return null;
    }
    // Bare `{ video: true }` on iOS returns the default (usually front). Reject it for
    // rear unless settings explicitly confirm environment.
    if (opts?.bareVideo && facingMode === 'environment' && reported !== 'environment') {
      stopStreamTracks(stream);
      return null;
    }
    if (!facingMatches(stream, facingMode) && (exactFacing || facingMode === 'environment')) {
      stopStreamTracks(stream);
      return null;
    }
    return finish(stream);
  };

  // Facing-first plans. Bare `{ video: true }` is LAST so rear switch cannot
  // silently succeed with the default front camera.
  const facingConstraint: MediaTrackConstraints = exactFacing
    ? { facingMode: { exact: facingMode } }
    : { facingMode: { ideal: facingMode } };

  type Plan = { constraints: MediaStreamConstraints; bareVideo?: boolean };
  const plans: Plan[] = [
    { constraints: { video: facingConstraint, audio: false } },
    ...(exactFacing
      ? []
      : [{ constraints: { video: { facingMode }, audio: false } as MediaStreamConstraints }]),
    ...(audio
      ? [
          { constraints: { video: facingConstraint, audio: true } as MediaStreamConstraints },
          ...(!exactFacing
            ? [{ constraints: { video: { facingMode }, audio: true } as MediaStreamConstraints }]
            : []),
        ]
      : []),
    // Last-resort any-camera — only when facing-specific plans fail.
    // For environment, accept() rejects unless settings confirm rear.
    { constraints: { video: true, audio: false }, bareVideo: true },
    ...(audio
      ? [{ constraints: { video: true, audio: true } as MediaStreamConstraints, bareVideo: true }]
      : []),
  ];

  let lastErr: unknown = null;

  for (const plan of plans) {
    try {
      const stream = await gum(plan.constraints);
      const accepted = await accept(stream, { bareVideo: plan.bareVideo });
      if (accepted) return accepted;
    } catch (err) {
      lastErr = err;
      if (isCameraPermissionError(err) || isTimeout(err)) {
        throw await friendlyFailure(err);
      }
      if (isNotReadable(err) || isNotFound(err)) {
        await sleep(isNotFound(err) ? 600 : 350);
        try {
          const stream = await gum({ video: facingConstraint, audio: false });
          const accepted = await accept(stream);
          if (accepted) return accepted;
        } catch (retryErr) {
          lastErr = retryErr;
          if (isCameraPermissionError(retryErr) || isTimeout(retryErr)) {
            throw await friendlyFailure(retryErr);
          }
        }
      }
    }
  }

  // Enumerate and pick a device that matches the requested side.
  const devices = await listVideoInputs();
  const ranked = [...devices].sort(
    (a, b) => scoreDeviceForFacing(a, facingMode) - scoreDeviceForFacing(b, facingMode),
  );

  for (const device of ranked) {
    if (!device.deviceId) continue;
    for (const deviceId of [
      { ideal: device.deviceId } as ConstrainDOMString,
      { exact: device.deviceId } as ConstrainDOMString,
    ]) {
      try {
        const stream = await gum({
          video: { deviceId, facingMode: { ideal: facingMode } },
          audio: false,
        });
        const accepted = await accept(stream);
        if (accepted) return accepted;
      } catch (err) {
        lastErr = err;
        if (isCameraPermissionError(err) || isTimeout(err)) throw await friendlyFailure(err);
      }
    }
  }

  throw await friendlyFailure(lastErr);
}
