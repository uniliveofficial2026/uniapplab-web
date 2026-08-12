/**
 * Single camera owner for the whole app (rebuilt).
 * Every surface (live, Create Room, chat call, karaoke, warm, AR) acquires/releases here —
 * never call getUserMedia for video in parallel.
 *
 * Reliability guarantees:
 * - One serialized lock, but it can NEVER deadlock: acquisition (openCameraMediaStream) is
 *   timeout-guarded and always settles, and the lock advances on both success and failure.
 * - Listeners fire when the shared stream changes so TRTC beauty rebinds without a 2nd camera.
 */
import { openCameraMediaStream, type CameraFacingMode } from './cameraAcquire';
import { WEBAR_CAMERA_FRAME_RATE } from './cameraPipelinePolicy';

export type { CameraFacingMode } from './cameraAcquire';

export type AppCameraAcquireOptions = {
  facingMode?: CameraFacingMode;
  audio?: boolean;
  videoIdeal?: { width: number; height: number };
  frameRate?: { ideal?: number; max?: number };
  exactFacing?: boolean;
  /** Warm / background leases yield immediately when a UI lease appears. */
  warm?: boolean;
};

type LeaseRecord = {
  id: string;
  warm: boolean;
  audio: boolean;
  facingMode: CameraFacingMode;
  exactFacing: boolean;
  videoIdeal: { width: number; height: number };
  frameRate: { ideal?: number; max?: number };
};

/** Keep camera warm across brief remounts (React Strict Mode / Create→Live). */
const RELEASE_GRACE_MS = 900;

let sharedStream: MediaStream | null = null;
let sharedFacing: CameraFacingMode = 'user';
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
const leases = new Map<string, LeaseRecord>();
const listeners = new Set<(stream: MediaStream | null) => void>();

/* ----------------------------- exclusive lock ----------------------------- */
// Runs camera-device operations one at a time. Always advances (success OR failure),
// so a rejected/slow op can never wedge future operations.
let lock: Promise<unknown> = Promise.resolve();
function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const result = lock.then(fn, fn);
  lock = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/* ------------------------------- utilities -------------------------------- */
function notify(stream: MediaStream | null): void {
  for (const listener of listeners) {
    try {
      listener(stream);
    } catch {
      /* ignore listener errors */
    }
  }
}

function stopStream(stream: MediaStream | null): void {
  if (!stream) return;
  try {
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    /* ignore */
  }
}

function isStreamLive(stream: MediaStream | null): boolean {
  return stream?.getVideoTracks()[0]?.readyState === 'live';
}

function clearReleaseTimer(): void {
  if (releaseTimer != null) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
}

function hasUiLease(): boolean {
  for (const lease of leases.values()) if (!lease.warm) return true;
  return false;
}

function dropWarmLeases(): void {
  for (const [id, lease] of [...leases.entries()]) if (lease.warm) leases.delete(id);
}

function mergedAudioNeed(): boolean {
  for (const lease of leases.values()) if (lease.audio) return true;
  return false;
}

function primaryLease(): LeaseRecord | null {
  for (const lease of leases.values()) if (!lease.warm) return lease;
  return leases.values().next().value ?? null;
}

function applyActualFacing(actual: CameraFacingMode): void {
  sharedFacing = actual;
  for (const lease of leases.values()) lease.facingMode = actual;
}

/* --------------------------- stream management ---------------------------- */
async function ensureStreamForLeases(): Promise<MediaStream | null> {
  const primary = primaryLease();
  if (!primary) return null;

  const needAudio = mergedAudioNeed();
  const liveVideo = isStreamLive(sharedStream);
  const liveAudio = sharedStream?.getAudioTracks().some((t) => t.readyState === 'live') ?? false;
  const facingOk = sharedFacing === primary.facingMode;

  // Reuse the live shared stream when it already satisfies the primary lease.
  if (sharedStream && liveVideo && facingOk && (!needAudio || liveAudio)) {
    return sharedStream;
  }

  // Upgrade in place: add a mic to an otherwise-good stream without reopening the camera.
  if (sharedStream && liveVideo && facingOk && needAudio && !liveAudio) {
    try {
      const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      audioOnly.getAudioTracks().forEach((t) => sharedStream?.addTrack(t));
      return sharedStream;
    } catch {
      return sharedStream; // video-only beats failing
    }
  }

  const previous = sharedStream;
  const opened = await openCameraMediaStream({
    facingMode: primary.facingMode,
    audio: needAudio,
    videoIdeal: primary.videoIdeal,
    frameRate: primary.frameRate,
    exactFacing: primary.exactFacing,
  });

  sharedStream = opened.stream;
  applyActualFacing(opened.facingMode);
  if (previous && previous !== opened.stream) stopStream(previous);
  notify(opened.stream);

  void import('../webar/tencentWebARWarm')
    .then((m) => m.onSharedInputReplaced(opened.stream))
    .catch(() => undefined);

  return opened.stream;
}

function scheduleReleaseIfEmpty(): void {
  clearReleaseTimer();
  if (leases.size > 0) return;
  const teardown = () => {
    if (leases.size > 0) return;
    stopStream(sharedStream);
    sharedStream = null;
    notify(null);
  };
  if (typeof window === 'undefined') {
    teardown();
    return;
  }
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    teardown();
  }, RELEASE_GRACE_MS);
}

/* -------------------------------- public API ------------------------------ */
export function getAppCameraStream(): MediaStream | null {
  return isStreamLive(sharedStream) ? sharedStream : null;
}

export function getAppCameraFacing(): CameraFacingMode {
  return sharedFacing;
}

/** Subscribe to the single camera stream — fires on open / flip / close. */
export function subscribeAppCamera(
  listener: (stream: MediaStream | null) => void,
  emitCurrent = true,
): () => void {
  listeners.add(listener);
  if (emitCurrent) listener(getAppCameraStream());
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Acquire the one device camera for `leaseId`.
 * Serialized + timeout-guarded — resolves with a stream or rejects with a clear error, never hangs.
 */
export function acquireAppCamera(
  leaseId: string,
  options: AppCameraAcquireOptions = {},
): Promise<MediaStream> {
  const id = leaseId.trim() || `lease-${Date.now()}`;
  const warm = Boolean(options.warm);
  const record: LeaseRecord = {
    id,
    warm,
    audio: Boolean(options.audio),
    facingMode: options.facingMode ?? 'user',
    exactFacing: options.exactFacing ?? false,
    videoIdeal: options.videoIdeal ?? { width: 640, height: 480 },
    frameRate: options.frameRate ?? WEBAR_CAMERA_FRAME_RATE,
  };

  return runExclusive(async () => {
    clearReleaseTimer();

    if (!warm) dropWarmLeases(); // UI always wins the device

    if (warm && hasUiLease()) {
      const existing = getAppCameraStream();
      if (existing) return existing; // don't pin a warm lease while UI owns the camera
    }

    leases.set(id, record);
    try {
      const stream = await ensureStreamForLeases();
      if (!stream) throw new Error('Could not access the camera.');
      return stream;
    } catch (err) {
      // Failed acquire must not keep a phantom lease alive.
      leases.delete(id);
      scheduleReleaseIfEmpty();
      throw err;
    }
  });
}

/** Release a lease. Camera stays up during a short grace window for Create→Live handoff. */
export function releaseAppCamera(leaseId: string): void {
  const id = leaseId.trim();
  if (!id) return;
  leases.delete(id);
  scheduleReleaseIfEmpty();
}

/** Flip facing without allowing a second concurrent camera open. */
export function setAppCameraFacing(facingMode: CameraFacingMode): Promise<MediaStream | null> {
  return runExclusive(async () => {
    if (leases.size === 0) {
      sharedFacing = facingMode;
      return getAppCameraStream();
    }
    const previous = sharedStream;
    const previousFacing = sharedFacing;
    for (const lease of leases.values()) lease.facingMode = facingMode;
    sharedFacing = facingMode;
    sharedStream = null;
    try {
      const next = await ensureStreamForLeases();
      if (previous && previous !== next) stopStream(previous);
      if (next) notify(next);
      return next;
    } catch {
      // Flip failed (e.g. no back camera) — restore the prior stream + facing if still live.
      if (isStreamLive(previous)) {
        sharedStream = previous;
        applyActualFacing(previousFacing);
        notify(previous);
        return previous;
      }
      throw new Error('This camera is not available on your device.');
    }
  });
}

export function isAppCameraHeld(): boolean {
  return leases.size > 0 && Boolean(getAppCameraStream());
}

/**
 * Hard-stop the shared camera (e.g. before a user-gesture Retry).
 * Does not clear active leases — the next ensureStreamForLeases reopen will run.
 */
export function forceResetAppCamera(): Promise<void> {
  return runExclusive(async () => {
    clearReleaseTimer();
    const previous = sharedStream;
    sharedStream = null;
    stopStream(previous);
    notify(null);
    // Let the OS release the device before the next getUserMedia.
    await new Promise((r) => setTimeout(r, 400));
  });
}
