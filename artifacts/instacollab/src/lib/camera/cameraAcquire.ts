/**
 * Camera acquisition — simplest getUserMedia first, then upgrade quality.
 *
 * Critical reliability rules:
 * 1. Ask for `{ video: true }` FIRST (permission + any camera).
 * 2. Every getUserMedia has a timeout; on TimeoutError we STOP (no cascade).
 * 3. NotFound often means "this browser is not allowed in OS Camera privacy"
 *    or a brief device-release race — diagnose with Permissions API + one delayed retry.
 */
import { isCameraPermissionError } from './errors';
import { explainInsecureMediaContext } from '../platform/runtime';

export type CameraFacingMode = 'user' | 'environment';

export type OpenCameraMediaOptions = {
  facingMode: CameraFacingMode;
  audio: boolean;
  videoIdeal: { width: number; height: number };
  frameRate?: { ideal?: number; max?: number };
  exactFacing?: boolean;
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

function detectFacing(stream: MediaStream, fallback: CameraFacingMode): CameraFacingMode {
  try {
    const f = stream.getVideoTracks()[0]?.getSettings().facingMode;
    if (f === 'user' || f === 'environment') return f;
  } catch {
    /* ignore */
  }
  return fallback;
}

async function gum(constraints: MediaStreamConstraints): Promise<MediaStream> {
  return hintMotion(
    await withTimeout(navigator.mediaDevices.getUserMedia(constraints), GUM_TIMEOUT_MS),
  );
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
    // macOS / Windows: master Camera toggle ON is not enough — the browser app must be ON.
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
 * Acquire a camera MediaStream.
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

  const { facingMode, audio, videoIdeal, frameRate } = opts;
  const finish = async (stream: MediaStream): Promise<OpenCameraMediaResult> => {
    await upgradeQuality(stream, videoIdeal, frameRate);
    return { stream, facingMode: detectFacing(stream, facingMode) };
  };

  // Always try video-only first when the caller asked for audio+video — a missing mic
  // makes Chrome return NotFound for the combined request (looks like "no camera").
  const plans: MediaStreamConstraints[] = audio
    ? [
        { video: true, audio: false },
        { video: { facingMode }, audio: false },
        { video: true, audio: true },
        { video: { facingMode }, audio: true },
      ]
    : [{ video: true }, { video: { facingMode } }];

  let lastErr: unknown = null;

  for (const constraints of plans) {
    try {
      return await finish(await gum(constraints));
    } catch (err) {
      lastErr = err;
      if (isCameraPermissionError(err) || isTimeout(err)) {
        throw await friendlyFailure(err);
      }
      if (isNotReadable(err) || isNotFound(err)) {
        // Device still releasing after a React remount / prior tab — wait, then one more try.
        await sleep(isNotFound(err) ? 600 : 350);
        try {
          return await finish(await gum({ video: true, audio: false }));
        } catch (retryErr) {
          lastErr = retryErr;
          if (isCameraPermissionError(retryErr) || isTimeout(retryErr)) {
            throw await friendlyFailure(retryErr);
          }
        }
      }
    }
  }

  // Prefer physical cameras first — Continuity / virtual cams often list but fail to open.
  const devices = await listVideoInputs();
  const ranked = [...devices].sort((a, b) => {
    const score = (d: MediaDeviceInfo) => {
      const label = (d.label || '').toLowerCase();
      if (/continuity|iphone|ipad|virtual|obs|snap|manycam|camo/.test(label)) return 2;
      if (/faceTime|integrated|built-?in|facetime/.test(label)) return 0;
      return 1;
    };
    return score(a) - score(b);
  });

  for (const device of ranked) {
    if (!device.deviceId) continue;
    try {
      return await finish(
        await gum({ video: { deviceId: { ideal: device.deviceId } }, audio: false }),
      );
    } catch (err) {
      lastErr = err;
      if (isCameraPermissionError(err) || isTimeout(err)) throw await friendlyFailure(err);
    }
    // exact as last resort for this device
    try {
      return await finish(
        await gum({ video: { deviceId: { exact: device.deviceId } }, audio: false }),
      );
    } catch (err) {
      lastErr = err;
      if (isCameraPermissionError(err) || isTimeout(err)) throw await friendlyFailure(err);
    }
  }

  throw await friendlyFailure(lastErr);
}
