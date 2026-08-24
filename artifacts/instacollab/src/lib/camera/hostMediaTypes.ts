/**
 * Coarse host-media lifecycle — never per-frame.
 * Presentation may subscribe to snapshots; it must not own GUM or Room.
 */

export type HostMediaState =
  | 'idle'
  | 'permission-required'
  | 'acquiring-camera'
  | 'raw-preview'
  | 'beauty-warming'
  | 'beauty-ready'
  | 'preparing-connection'
  | 'connecting'
  | 'publishing'
  | 'live'
  | 'switching-camera'
  | 'recovering'
  | 'stopping'
  | 'ended'
  | 'error';

export const HOST_MEDIA_STATES: readonly HostMediaState[] = [
  'idle',
  'permission-required',
  'acquiring-camera',
  'raw-preview',
  'beauty-warming',
  'beauty-ready',
  'preparing-connection',
  'connecting',
  'publishing',
  'live',
  'switching-camera',
  'recovering',
  'stopping',
  'ended',
  'error',
] as const;

export type HostMediaSnapshot = {
  state: HostMediaState;
  cameraReady: boolean;
  beautyReady: boolean;
  connecting: boolean;
  publishing: boolean;
  live: boolean;
  recovering: boolean;
  errorCode: string | null;
  presetId: string | null;
  generation: number;
  roomId: string | null;
};

export function deriveHostMediaSnapshot(input: {
  state: HostMediaState;
  errorCode?: string | null;
  presetId?: string | null;
  generation: number;
  roomId?: string | null;
}): HostMediaSnapshot {
  const state = input.state;
  return {
    state,
    cameraReady:
      state === 'raw-preview' ||
      state === 'beauty-warming' ||
      state === 'beauty-ready' ||
      state === 'preparing-connection' ||
      state === 'connecting' ||
      state === 'publishing' ||
      state === 'live' ||
      state === 'switching-camera',
    beautyReady: state === 'beauty-ready' || state === 'live' || state === 'publishing',
    connecting: state === 'preparing-connection' || state === 'connecting',
    publishing: state === 'publishing',
    live: state === 'live',
    recovering: state === 'recovering',
    errorCode: input.errorCode ?? null,
    presetId: input.presetId ?? null,
    generation: input.generation,
    roomId: input.roomId ?? null,
  };
}
