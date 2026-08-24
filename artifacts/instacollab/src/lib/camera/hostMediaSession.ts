/**
 * Exclusive host media lifecycle controller.
 * Presentation subscribes to coarse snapshots only — never calls GUM or `new Room()`.
 */

import { getBeautyEngineAdapter } from '../ar/beautyEngineAdapter';
import { fetchPartyLiveKitToken } from '../platformApi';
import {
  disposeHostLiveKitRoom,
  prefetchHostLiveKitAuth,
  prepareHostLiveKitConnection,
} from '../livekit/hostLiveKitRoom';
import {
  deriveHostMediaSnapshot,
  type HostMediaSnapshot,
  type HostMediaState,
} from './hostMediaTypes';
import {
  markHostMediaTrace,
  resetHostMediaTrace,
} from './hostMediaTrace';
import {
  resetHostMediaFrameStats,
  startHostMediaFrameStats,
  stopHostMediaFrameStats,
} from './hostMediaFrameStats';

export type { HostMediaSnapshot, HostMediaState } from './hostMediaTypes';

export type HostMediaPrejoinOptions = {
  roomId: string;
  canPublish: boolean;
  hidden?: boolean;
};

type HostMediaInternal = {
  state: HostMediaState;
  errorCode: string | null;
  presetId: string | null;
  generation: number;
  roomId: string | null;
};

const internal: HostMediaInternal = {
  state: 'idle',
  errorCode: null,
  presetId: null,
  generation: 0,
  roomId: null,
};

const listeners = new Set<(snapshot: HostMediaSnapshot) => void>();

function emit(): HostMediaSnapshot {
  const snapshot = deriveHostMediaSnapshot(internal);
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch {
      /* ignore subscriber errors */
    }
  }
  return snapshot;
}

export function getHostMediaSnapshot(): HostMediaSnapshot {
  return deriveHostMediaSnapshot(internal);
}

export function subscribeHostMedia(listener: (snapshot: HostMediaSnapshot) => void): () => void {
  listeners.add(listener);
  listener(getHostMediaSnapshot());
  return () => {
    listeners.delete(listener);
  };
}

export function getHostMediaGeneration(): number {
  return internal.generation;
}

export function isStaleHostMediaGeneration(generation: number): boolean {
  return generation !== internal.generation;
}

export function setHostMediaState(
  state: HostMediaState,
  extras?: { errorCode?: string | null; presetId?: string | null },
): HostMediaSnapshot {
  internal.state = state;
  if (extras && 'errorCode' in extras) internal.errorCode = extras.errorCode ?? null;
  if (extras && 'presetId' in extras) internal.presetId = extras.presetId ?? null;
  if (state === 'error' && !internal.errorCode) internal.errorCode = 'host_media_error';
  if (state === 'idle' || state === 'ended') internal.errorCode = extras?.errorCode ?? null;
  return emit();
}

export function setHostMediaPresetId(presetId: string | null): void {
  internal.presetId = presetId;
  emit();
}

/**
 * After explicit Go Live / prejoin intent: warm beauty + authorized token +
 * LiveKit prepareConnection in parallel with the existing camera lease.
 * Does not acquire a second camera. Does not grant publish rights.
 */
export async function startHostMediaPrejoin(options: HostMediaPrejoinOptions): Promise<void> {
  const roomId = options.roomId.trim();
  if (!roomId) return;

  const generation = ++internal.generation;
  internal.roomId = roomId;
  internal.errorCode = null;
  resetHostMediaTrace();
  markHostMediaTrace('go_live_tap');
  markHostMediaTrace('prejoin_painted');
  setHostMediaState('acquiring-camera');
  startHostMediaFrameStats();

  const beauty = getBeautyEngineAdapter();
  const beautyPromise = (async () => {
    markHostMediaTrace('beauty_prepare_started');
    try {
      await beauty.prepare({ tier: 'standard' });
      if (isStaleHostMediaGeneration(generation)) return;
      markHostMediaTrace('beauty_prepare_completed');
      if (internal.state === 'raw-preview' || internal.state === 'acquiring-camera') {
        setHostMediaState('beauty-warming');
      }
    } catch {
      /* beauty failure must not block live */
    }
  })();

  const tokenFetcher = () =>
    fetchPartyLiveKitToken(roomId, options.hidden ? false : options.canPublish, {
      hidden: Boolean(options.hidden),
    });

  const connectionPromise = (async () => {
    try {
      await prefetchHostLiveKitAuth(roomId, tokenFetcher);
      if (isStaleHostMediaGeneration(generation)) return;
      setHostMediaState('preparing-connection');
      await prepareHostLiveKitConnection(roomId, tokenFetcher);
    } catch {
      if (!isStaleHostMediaGeneration(generation)) {
        setHostMediaState(internal.state === 'idle' ? 'error' : internal.state, {
          errorCode: 'token_or_prepare_failed',
        });
      }
    }
  })();

  await Promise.allSettled([beautyPromise, connectionPromise]);
}

export function stopHostMediaPrejoin(roomId?: string): void {
  if (roomId && internal.roomId && internal.roomId !== roomId) return;
  internal.generation += 1;
}

export async function suspendHostMedia(): Promise<void> {
  if (internal.state === 'idle' || internal.state === 'ended' || internal.state === 'stopping') {
    return;
  }
  try {
    await getBeautyEngineAdapter().suspend();
  } catch {
    /* ignore */
  }
}

export async function resumeHostMedia(): Promise<void> {
  if (internal.state === 'idle' || internal.state === 'ended') return;
  try {
    await getBeautyEngineAdapter().resume();
  } catch {
    /* raw preview remains */
  }
}

export async function endHostMediaSession(reason: 'leave' | 'logout' | 'ended' = 'leave'): Promise<void> {
  internal.generation += 1;
  setHostMediaState('stopping');
  stopHostMediaFrameStats();
  resetHostMediaFrameStats();
  const roomId = internal.roomId;
  internal.roomId = null;
  internal.presetId = null;
  try {
    await getBeautyEngineAdapter().dispose();
  } catch {
    /* ignore */
  }
  try {
    await disposeHostLiveKitRoom(roomId ?? undefined);
  } catch {
    /* ignore */
  }
  setHostMediaState(reason === 'logout' ? 'ended' : 'ended');
  void reason;
}

export function noteHostCameraAcquiring(): void {
  markHostMediaTrace('camera_request_started');
  if (internal.state === 'idle' || internal.state === 'permission-required') {
    setHostMediaState('acquiring-camera');
  }
}

export function noteHostCameraPermission(denied: boolean): void {
  markHostMediaTrace('camera_permission_resolved');
  if (denied) setHostMediaState('permission-required', { errorCode: 'camera_permission_denied' });
}

export function noteHostRawPreviewReady(): void {
  markHostMediaTrace('camera_track_created');
  markHostMediaTrace('first_raw_frame');
  if (
    internal.state === 'idle' ||
    internal.state === 'acquiring-camera' ||
    internal.state === 'permission-required' ||
    internal.state === 'switching-camera'
  ) {
    setHostMediaState('raw-preview');
  }
}

export function noteHostBeautyReady(): void {
  markHostMediaTrace('first_beauty_frame');
  if (
    internal.state === 'raw-preview' ||
    internal.state === 'beauty-warming' ||
    internal.state === 'acquiring-camera'
  ) {
    setHostMediaState('beauty-ready');
  }
}

export function noteHostPublishing(): void {
  markHostMediaTrace('publish_started');
  if (internal.state !== 'live') setHostMediaState('publishing');
}

export function noteHostTrackPublished(): void {
  markHostMediaTrace('track_published');
  setHostMediaState('live');
}

export function noteHostCameraSwitchStarted(): void {
  markHostMediaTrace('camera_switch_started');
  setHostMediaState('switching-camera');
}

export function noteHostCameraSwitchFrame(): void {
  markHostMediaTrace('camera_switch_first_frame');
  if (internal.state === 'switching-camera') setHostMediaState('raw-preview');
}

export function noteHostRecovering(errorCode?: string): void {
  setHostMediaState('recovering', { errorCode: errorCode ?? 'recovering' });
}

export function noteHostMediaError(errorCode: string): void {
  setHostMediaState('error', { errorCode });
}
