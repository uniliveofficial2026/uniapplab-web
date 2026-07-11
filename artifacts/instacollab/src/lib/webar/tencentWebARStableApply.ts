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

function applyInstantLook(
  instance: TencentWebARInstance,
  state: TencentWebARApplyState,
  stack: Array<string | { id: string; intensity?: number; filterIntensity?: number }>,
): void {
  const { beautify, effects, beautyOn, mirror } = state;
  try {
    instance.setCommonConfig?.({ mirror });
  } catch {
    /* ignore */
  }

  if (!beautyOn) {
    try {
      instance.setEffect?.(null);
    } catch {
      /* ignore */
    }
    try {
      instance.setFilter?.(null);
    } catch {
      /* ignore */
    }
    try {
      instance.setBeautify(BEAUTY_OFF_PARAMS);
    } catch {
      /* ignore */
    }
    try {
      instance.disable?.();
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    instance.enable?.();
  } catch {
    /* ignore */
  }
  try {
    instance.setBeautify(beautify);
  } catch {
    /* ignore */
  }
  try {
    if (effects.filterId) instance.setFilter?.(effects.filterId, 1);
    else instance.setFilter?.(null);
  } catch {
    /* ignore */
  }
  try {
    instance.setEffect?.(stack.length > 0 ? stack : null);
  } catch {
    /* ignore */
  }
}

/** Apply TRTC state. Beautify/filter/effects apply immediately; assets preload in the background. */
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

  const { beautify, effects, beautyOn, needsSegmentation, mirror } = state;
  const stack = buildEffectStack(effects);

  applyInstantLook(instance, state, stack);

  if (options?.lastKeyRef) {
    options.lastKeyRef.current = key;
  }

  return enqueueTencentWebAREffect(async () => {
    // Drop stale jobs — a newer apply already owns lastKeyRef.
    if (options?.lastKeyRef && options.lastKeyRef.current !== key) return;

    const segmentationOnRef = options?.segmentationOnRef;
    if (segmentationOnRef && segmentationOnRef.current !== needsSegmentation) {
      try {
        instance.setDetectModuleConfig?.({
          beautify: true,
          segmentation: needsSegmentation,
          ...(needsSegmentation ? { segmentationLevel: 2 as const } : {}),
        });
        if (needsSegmentation) {
          await instance.setSegmentationLevel?.(2);
        }
        segmentationOnRef.current = needsSegmentation;
      } catch {
        /* ignore */
      }
    }

    if (options?.lastKeyRef && options.lastKeyRef.current !== key) return;

    const preloadIds = [effects.makeupId, effects.stickerId, effects.shapeEffectId].filter(
      Boolean,
    ) as string[];
    if (preloadIds.length > 0) {
      await preloadEffectIds(instance, preloadIds);
    }

    if (options?.lastKeyRef && options.lastKeyRef.current !== key) return;

    applyInstantLook(instance, state, stack);

    try {
      if (effects.backgroundUrl && beautyOn) {
        const bg = resolveTencentBackgroundSrc(effects.backgroundUrl);
        const type =
          effects.backgroundType ?? bg.type ?? inferTencentBackgroundType(effects.backgroundUrl);
        await instance.setBackground?.({ type, src: bg.src });
      } else {
        await instance.setBackground?.(null);
      }
    } catch {
      /* ignore */
    }

    if (options?.lastKeyRef && options.lastKeyRef.current !== key) return;
    if (options?.lastKeyRef) {
      options.lastKeyRef.current = key;
    }
  });
}
