import type { BeautyPresetId } from '../../lib/ar/beautyFilters';
import type { BodyShapeParams } from '../../lib/ar/bodyShape';
import { EMPTY_BODY_SHAPE } from '../../lib/ar/bodyShape';
import {
  EMPTY_TENCENT_EFFECT_SELECTION,
  type TencentEffectSelection,
} from '../../lib/webar/webarTypes';

export type LastVideoCallBeauty = {
  beautyId: BeautyPresetId;
  beautyEffects: TencentEffectSelection;
  bodyShape: BodyShapeParams;
};

const STORAGE_KEY = 'lastVideoCallBeauty';

export function stashLastVideoCallBeauty(detail: LastVideoCallBeauty): void {
  try {
    const effects = detail.beautyEffects;
    // Blob URLs die with the document; skip them so storage stays valid.
    const beautyEffects =
      effects.backgroundUrl?.startsWith('blob:')
        ? { ...effects, backgroundUrl: null, backgroundType: null }
        : effects;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...detail, beautyEffects }),
    );
  } catch {
    /* ignore */
  }
}

export function readLastVideoCallBeauty(): LastVideoCallBeauty | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastVideoCallBeauty>;
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
    };
  } catch {
    return null;
  }
}
