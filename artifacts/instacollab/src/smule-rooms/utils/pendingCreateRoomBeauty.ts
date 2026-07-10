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

export function stashPendingCreateRoomBeauty(detail: PendingCreateRoomBeauty): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(detail));
  } catch {
    /* ignore */
  }
}

export function peekPendingCreateRoomBeauty(): PendingCreateRoomBeauty | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingCreateRoomBeauty>;
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
  } catch {
    return null;
  }
}

export function consumePendingCreateRoomBeauty(): PendingCreateRoomBeauty | null {
  const detail = peekPendingCreateRoomBeauty();
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return detail;
}
