import { BEAUTY_OFF_PARAMS } from '../ar/beautyFilters';
import type { TencentBeautifyParams, TencentEffectSelection, TencentWebARInstance } from './webarTypes';
import { inferTencentBackgroundType, resolveTencentBackgroundSrc } from './webarBackgroundImage';
import { enqueueTencentWebAREffect } from './tencentWebAREffectQueue';

export type TencentWebARApplyState = {
  beautify: TencentBeautifyParams;
  effects: TencentEffectSelection;
  beautyOn: boolean;
  needsSegmentation: boolean;
  mirror: boolean;
};

function buildEffectStack(effects: TencentEffectSelection) {
  const stack: Array<string | { id: string; intensity?: number; filterIntensity?: number }> = [];
  if (effects.makeupId) {
    stack.push({ id: effects.makeupId, intensity: 1, filterIntensity: 0 });
  }
  if (effects.stickerId) {
    stack.push(effects.stickerId);
  }
  if (effects.shapeEffectId) {
    stack.push(effects.shapeEffectId);
  }
  return stack;
}

async function preloadEffectIds(instance: TencentWebARInstance, ids: string[]) {
  if (ids.length === 0 || !instance.preloadEffectByIds) return;
  await Promise.all(
    ids.filter(Boolean).map(
      (id) =>
        new Promise<void>((resolve) => {
          instance.preloadEffectByIds?.(
            [id],
            () => resolve(),
            () => resolve(),
          );
        }),
    ),
  );
}

export function buildTencentWebARApplyKey(state: TencentWebARApplyState): string {
  const { beautify, effects, beautyOn, needsSegmentation, mirror } = state;
  return JSON.stringify({
    beautyOn,
    needsSegmentation,
    mirror,
    beautify,
    effects,
  });
}

/** Serialize TRTC applies — preload assets, then beautify → stack → filter → background. */
export function applyTencentWebARState(
  instance: TencentWebARInstance,
  state: TencentWebARApplyState,
  options?: {
    segmentationOnRef?: { current: boolean };
    force?: boolean;
    lastKeyRef?: { current: string };
  },
): Promise<void> {
  const key = buildTencentWebARApplyKey(state);
  if (!options?.force && options?.lastKeyRef && options.lastKeyRef.current === key) {
    return Promise.resolve();
  }

  return enqueueTencentWebAREffect(async () => {
    const { beautify, effects, beautyOn, needsSegmentation, mirror } = state;

    try {
      instance.setCommonConfig?.({ mirror });
    } catch {
      /* ignore */
    }

    const segmentationOnRef = options?.segmentationOnRef;
    if (segmentationOnRef && segmentationOnRef.current !== needsSegmentation) {
      segmentationOnRef.current = needsSegmentation;
      try {
        instance.setDetectModuleConfig?.({
          beautify: true,
          segmentation: needsSegmentation,
          ...(needsSegmentation ? { segmentationLevel: 2 as const } : {}),
        });
        if (needsSegmentation) {
          await instance.setSegmentationLevel?.(2);
        }
      } catch {
        /* ignore */
      }
    }

    const preloadIds = [effects.makeupId, effects.stickerId, effects.shapeEffectId].filter(
      Boolean,
    ) as string[];
    if (preloadIds.length > 0) {
      await preloadEffectIds(instance, preloadIds);
    }

    instance.setBeautify(beautyOn ? beautify : BEAUTY_OFF_PARAMS);

    const stack = buildEffectStack(effects);
    instance.setEffect?.(stack.length > 0 ? stack : null);

    if (effects.filterId) instance.setFilter?.(effects.filterId, 1);
    else instance.setFilter?.(null);

    if (effects.backgroundUrl) {
      const bg = resolveTencentBackgroundSrc(effects.backgroundUrl);
      const type =
        effects.backgroundType ?? bg.type ?? inferTencentBackgroundType(effects.backgroundUrl);
      await instance.setBackground?.({ type, src: bg.src });
    } else {
      await instance.setBackground?.(null);
    }

    if (beautyOn) instance.enable?.();
    else instance.disable?.();

    if (options?.lastKeyRef) {
      options.lastKeyRef.current = key;
    }
  });
}
