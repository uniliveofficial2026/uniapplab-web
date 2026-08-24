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
    const intensity = Math.max(0, Math.min(1, effects.makeupIntensity ?? 1));
    stack.push({ id: effects.makeupId, intensity, filterIntensity: 0 });
  }
  if (effects.stickerId) {
    stack.push(effects.stickerId);
  }
  if (effects.shapeEffectId) {
    stack.push(effects.shapeEffectId);
  }
  return stack;
}

function assetIdsFromEffects(effects: TencentEffectSelection): string[] {
  return [effects.makeupId, effects.stickerId, effects.shapeEffectId].filter(Boolean) as string[];
}

function buildBeautifyKey(beautify: TencentBeautifyParams): string {
  return JSON.stringify(beautify);
}

function buildAssetsKey(effects: TencentEffectSelection, beautyOn: boolean): string {
  return JSON.stringify({
    beautyOn,
    makeupId: effects.makeupId ?? null,
    makeupIntensity: effects.makeupIntensity ?? null,
    stickerId: effects.stickerId ?? null,
    shapeEffectId: effects.shapeEffectId ?? null,
    filterId: effects.filterId ?? null,
    backgroundUrl: effects.backgroundUrl ?? null,
    backgroundType: effects.backgroundType ?? null,
  });
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
      return;
    }
    setTimeout(resolve, 0);
  });
}

async function preloadEffectIds(instance: TencentWebARInstance, ids: string[]) {
  if (ids.length === 0 || !instance.preloadEffectByIds) return;
  await Promise.all(
    ids.filter(Boolean).map(
      (id) =>
        new Promise<void>((resolve) => {
          try {
            instance.preloadEffectByIds?.(
              [id],
              () => resolve(),
              () => resolve(),
            );
          } catch {
            resolve();
          }
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

function applyBeautifyOnly(
  instance: TencentWebARInstance,
  state: TencentWebARApplyState,
): void {
  const { beautify, beautyOn, mirror } = state;
  try {
    instance.setCommonConfig?.({ mirror });
  } catch {
    /* ignore */
  }

  if (!beautyOn) {
    try {
      instance.setBeautify(BEAUTY_OFF_PARAMS);
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
}

function applyFilterAndEffects(
  instance: TencentWebARInstance,
  state: TencentWebARApplyState,
  stack: Array<string | { id: string; intensity?: number; filterIntensity?: number }>,
): void {
  const { effects, beautyOn } = state;
  if (!beautyOn) {
    try {
      instance.setFilter?.(null);
    } catch {
      /* ignore */
    }
    try {
      instance.setEffect?.(null);
    } catch {
      /* ignore */
    }
    return;
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

type ApplyOptions = {
  segmentationOnRef?: { current: boolean };
  force?: boolean;
  lastKeyRef?: { current: string };
  lastBeautifyKeyRef?: { current: string };
  lastAssetsKeyRef?: { current: string };
};

/**
 * ALL SDK calls are deferred off the click stack (latest-wins queue + paint yield).
 * This is required — setBeautify/setEffect on the tap handler blocked 1–5s and blanked UI.
 */
export function applyTencentWebARState(
  instance: TencentWebARInstance,
  state: TencentWebARApplyState,
  options?: ApplyOptions,
): Promise<void> {
  const key = buildTencentWebARApplyKey(state);
  if (!options?.force && options?.lastKeyRef && options.lastKeyRef.current === key) {
    return Promise.resolve();
  }

  const { effects, beautyOn, needsSegmentation } = state;
  const stack = buildEffectStack(effects);
  const beautifyKey = buildBeautifyKey(state.beautify);
  const assetsKey = buildAssetsKey(effects, beautyOn);
  const prevBeautifyKey = options?.lastBeautifyKeyRef?.current ?? '';
  const prevAssetsKey = options?.lastAssetsKeyRef?.current ?? '';
  const beautifyChanged = options?.force || prevBeautifyKey !== beautifyKey;
  const assetsChanged = options?.force || prevAssetsKey !== assetsKey;
  const assetIds = assetIdsFromEffects(effects);
  const needsHeavyWork =
    assetsChanged ||
    Boolean(effects.backgroundUrl) ||
    Boolean(options?.segmentationOnRef && options.segmentationOnRef.current !== needsSegmentation);

  // Claim this key immediately so superseded taps cancel older queue work.
  if (options?.lastKeyRef) options.lastKeyRef.current = key;
  if (options?.lastBeautifyKeyRef && beautifyChanged) {
    options.lastBeautifyKeyRef.current = beautifyKey;
  }
  if (options?.lastAssetsKeyRef && assetsChanged) {
    options.lastAssetsKeyRef.current = assetsKey;
  }

  return enqueueTencentWebAREffect(async () => {
    if (options?.lastKeyRef && options.lastKeyRef.current !== key) return;
    await yieldToMain();
    if (options?.lastKeyRef && options.lastKeyRef.current !== key) return;

    if (beautifyChanged || options?.force || !beautyOn || !needsHeavyWork) {
      applyBeautifyOnly(instance, state);
      // setBeautify can burn 200–800ms on first GPU bind — yield before effects/UI.
      await yieldToMain();
    }

    if (!needsHeavyWork) return;
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

    if (assetIds.length > 0) {
      await preloadEffectIds(instance, assetIds);
    }

    if (options?.lastKeyRef && options.lastKeyRef.current !== key) return;
    await yieldToMain();
    if (options?.lastKeyRef && options.lastKeyRef.current !== key) return;

    applyBeautifyOnly(instance, state);
    applyFilterAndEffects(instance, state, stack);

    try {
      if (effects.backgroundUrl && beautyOn) {
        const bg = resolveTencentBackgroundSrc(effects.backgroundUrl);
        const type =
          effects.backgroundType ?? bg.type ?? inferTencentBackgroundType(effects.backgroundUrl);
        await instance.setBackground?.({ type, src: bg.src });
      } else if (assetsChanged && !effects.backgroundUrl) {
        await instance.setBackground?.(null);
      }
    } catch {
      /* ignore */
    }
  });
}
