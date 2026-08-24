import type { BeautyPresetId } from '../../lib/ar/beautyFilters';
import { LIVE_BEAUTY_PRESETS } from '../../lib/ar/beautyFilters';
import type { BodyShapeParams } from '../../lib/ar/bodyShape';
import { EMPTY_BODY_SHAPE } from '../../lib/ar/bodyShape';
import {
  EMPTY_TENCENT_EFFECT_SELECTION,
  type TencentBeautifyParams,
  type TencentEffectSelection,
} from '../../lib/webar/webarTypes';
import {
  resolveMultiGuestSeatCount,
  type MultiGuestSeatCount,
} from './roomSeats';

const BEAUTY_PRESET_IDS = new Set<BeautyPresetId>(LIVE_BEAUTY_PRESETS.map((row) => row.id));

function asBeautyPresetId(value: unknown): BeautyPresetId {
  if (typeof value === 'string' && BEAUTY_PRESET_IDS.has(value as BeautyPresetId)) {
    return value as BeautyPresetId;
  }
  return 'none';
}

export type PendingCreateRoomBeauty = {
  beautyId: BeautyPresetId;
  beautyEffects: TencentEffectSelection;
  bodyShape: BodyShapeParams;
  /** Custom slider values from Create Room; applied on the live stream. */
  beautifyOverride?: TencentBeautifyParams | null;
  roomMode: 'Solo-Live' | 'Commerce-Live' | 'Multi-Guest';
  multiGuestSeatCount?: MultiGuestSeatCount;
};

const STORAGE_KEY = 'pendingCreateRoomBeauty';

/**
 * Survives React Strict Mode remount: first take clears sessionStorage but keeps
 * the in-memory copy so the second mount still receives the same beauty setup.
 */
let memoryHandoff: PendingCreateRoomBeauty | null = null;

function normalizePending(
  parsed: Partial<PendingCreateRoomBeauty>,
): PendingCreateRoomBeauty | null {
  if (
    parsed.roomMode !== 'Solo-Live' &&
    parsed.roomMode !== 'Commerce-Live' &&
    parsed.roomMode !== 'Multi-Guest'
  ) {
    return null;
  }
  return {
    beautyId: asBeautyPresetId(parsed.beautyId),
    beautyEffects: {
      ...EMPTY_TENCENT_EFFECT_SELECTION,
      ...(parsed.beautyEffects ?? {}),
    },
    bodyShape: {
      ...EMPTY_BODY_SHAPE,
      ...(parsed.bodyShape ?? {}),
    },
    beautifyOverride: isBeautifyParams(parsed.beautifyOverride)
      ? parsed.beautifyOverride
      : null,
    roomMode: parsed.roomMode,
    multiGuestSeatCount:
      parsed.multiGuestSeatCount == null
        ? undefined
        : resolveMultiGuestSeatCount(parsed.multiGuestSeatCount),
  };
}

function isBeautifyParams(value: unknown): value is TencentBeautifyParams {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function stashPendingCreateRoomBeauty(detail: PendingCreateRoomBeauty): void {
  memoryHandoff = detail;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(detail));
  } catch {
    /* ignore quota / private mode */
  }
}

export function peekPendingCreateRoomBeauty(): PendingCreateRoomBeauty | null {
  if (memoryHandoff) return memoryHandoff;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizePending(JSON.parse(raw) as Partial<PendingCreateRoomBeauty>);
  } catch {
    return null;
  }
}

/**
 * Take ownership for Room init. Safe under Strict Mode double-mount:
 * returns the same handoff until the next stash.
 */
export function takePendingCreateRoomBeauty(): PendingCreateRoomBeauty | null {
  if (memoryHandoff) {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return memoryHandoff;
  }
  const detail = peekPendingCreateRoomBeauty();
  if (!detail) return null;
  memoryHandoff = detail;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return detail;
}

/** @deprecated Prefer takePendingCreateRoomBeauty for Room mount. */
export function consumePendingCreateRoomBeauty(): PendingCreateRoomBeauty | null {
  return takePendingCreateRoomBeauty();
}
