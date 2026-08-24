/**
 * Shared vision + media render graph contracts.
 * Prevents duplicate full analyses (WebAR / DeepAR / MediaPipe) from owning separate pipelines.
 * Camera must never wait on AI — newest-frame-only.
 */

export type SharedVisionState = {
  updatedAt: number;
  face?: unknown;
  pose?: unknown;
  hands?: unknown;
  personMask?: unknown;
  backgroundSegmentation?: unknown;
  depthEstimate?: unknown;
  hostTrackId?: string | null;
  confidence?: number;
};

export type MediaRenderStage =
  | 'camera'
  | 'beauty'
  | 'makeup'
  | 'filter'
  | 'bg'
  | 'stickers'
  | 'ar_gifts'
  | 'particles'
  | 'final_track';

/** Drop stale analysis work — keep only the newest frame ticket. */
export class NewestFrameOnlyGate {
  private latestTicket = 0;

  next(): number {
    this.latestTicket += 1;
    return this.latestTicket;
  }

  isCurrent(ticket: number): boolean {
    return ticket === this.latestTicket;
  }
}

let sharedVision: SharedVisionState = { updatedAt: 0 };

export function getSharedVisionState(): SharedVisionState {
  return sharedVision;
}

export function publishSharedVisionState( partial: Partial<SharedVisionState>): SharedVisionState {
  sharedVision = {
    ...sharedVision,
    ...partial,
    updatedAt: Date.now(),
  };
  return sharedVision;
}

export const MEDIA_RENDER_ORDER: MediaRenderStage[] = [
  'camera',
  'beauty',
  'makeup',
  'filter',
  'bg',
  'stickers',
  'ar_gifts',
  'particles',
  'final_track',
];
