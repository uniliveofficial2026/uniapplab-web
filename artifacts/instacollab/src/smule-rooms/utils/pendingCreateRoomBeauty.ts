import type { BeautyPresetId } from '../../lib/ar/beautyFilters';
import type { BodyShapeParams } from '../../lib/ar/bodyShape';
import { EMPTY_BODY_SHAPE } from '../../lib/ar/bodyShape';
import {
  EMPTY_TENCENT_EFFECT_SELECTION,
  type TencentEffectSelection,
} from '../../lib/webar/webarTypes';

export type PendingCreateRoomBeauty = {
  beautyId: BeautyPresetId;
  beautyEffects: TencentEffectSelection;
  bodyShape: BodyShapeParams;
  roomMode: 'Solo-Live' | 'Commerce-Live';
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
  if (parsed.roomMode !== 'Solo-Live' && parsed.roomMode !== 'Commerce-Live') {
    return null;
  }
  return {
    beautyId: (parsed.beautyId as BeautyPresetId) || 'none',
    beautyEffects: {
      ...EMPTY_TENCENT_EFFECT_SELECTION,
      ...(parsed.beautyEffects ?? {}),
    },
    bodyShape: {
      ...EMPTY_BODY_SHAPE,
      ...(parsed.bodyShape ?? {}),
    },
    roomMode: parsed.roomMode,
  };
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
