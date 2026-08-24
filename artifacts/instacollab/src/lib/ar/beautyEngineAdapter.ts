/**
 * Imperative beauty adapter over the existing Tencent WebAR singleton.
 * Does not replace the SDK. Preset/slider changes must not reopen the camera.
 * Admin may only select shipped presets — no remote shaders/scripts.
 */

import {
  BEAUTY_OFF_PARAMS,
  getTencentBeautifyParams,
  isTencentBeautifyActive,
} from './beautyFilters';
import {
  acquireSharedTencentWebAR,
  ensureSharedTencentWebAR,
  getSharedTencentWebARInstance,
  getSharedTencentWebAROutputStream,
  hydrateTencentWebARCatalogsFromStorage,
  preloadTencentWebARModule,
  releaseSharedTencentWebAR,
  syncSharedTencentWebARInput,
  warmTencentWebARForVideoCall,
} from '../webar/tencentWebARPool';
import { applyTencentWebARState } from '../webar/tencentWebARStableApply';
import { isTencentWebARConfigured } from '../webar/webarConfig';
import { EMPTY_TENCENT_EFFECT_SELECTION } from '../webar/webarTypes';
import type { TencentBeautifyParams } from '../webar/webarTypes';

export type BeautyPerformanceTier = 'low' | 'standard' | 'high';

export type BeautyPrepareOptions = {
  tier?: BeautyPerformanceTier;
};

export interface BeautyEngineAdapter {
  prepare(options: BeautyPrepareOptions): Promise<void>;
  attachInput(track: MediaStreamTrack): Promise<MediaStreamTrack>;
  applyPreset(presetId: string): Promise<void>;
  updateParameters(values: Record<string, number>): void;
  setPerformanceTier(tier: BeautyPerformanceTier): void;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  dispose(): Promise<void>;
}

const TIER_FPS: Record<BeautyPerformanceTier, number> = {
  low: 15,
  standard: 24,
  high: 30,
};

let prepared = false;
let preparing: Promise<void> | null = null;
let consumerHeld = false;
let tier: BeautyPerformanceTier = 'standard';
let lastParams: TencentBeautifyParams = { ...BEAUTY_OFF_PARAMS };
let lastPresetId = 'none';
let lastInput: MediaStream | null = null;

function outputFps(): number {
  return TIER_FPS[tier] ?? 24;
}

async function applyCurrentState(): Promise<void> {
  const instance = getSharedTencentWebARInstance();
  if (!instance) return;
  const beautyOn = lastPresetId !== 'none' || isTencentBeautifyActive(lastParams);
  await applyTencentWebARState(instance, {
    beautify: lastParams,
    effects: EMPTY_TENCENT_EFFECT_SELECTION,
    beautyOn,
    needsSegmentation: false,
    mirror: false,
  });
}

class TencentBeautyEngineAdapter implements BeautyEngineAdapter {
  async prepare(options: BeautyPrepareOptions = {}): Promise<void> {
    if (options.tier) tier = options.tier;
    if (prepared) return;
    if (preparing) return preparing;
    preparing = (async () => {
      if (!isTencentWebARConfigured()) {
        prepared = true;
        return;
      }
      hydrateTencentWebARCatalogsFromStorage();
      preloadTencentWebARModule();
      warmTencentWebARForVideoCall();
      prepared = true;
    })().finally(() => {
      preparing = null;
    });
    return preparing;
  }

  async attachInput(track: MediaStreamTrack): Promise<MediaStreamTrack> {
    await this.prepare({});
    if (!isTencentWebARConfigured() || track.readyState !== 'live') return track;
    const input = new MediaStream([track]);
    lastInput = input;
    if (!consumerHeld) {
      acquireSharedTencentWebAR();
      consumerHeld = true;
    }
    try {
      const ensured = await ensureSharedTencentWebAR({
        inputStream: input,
        mirror: false,
        needsSegmentation: false,
        outputFps: outputFps(),
      });
      const output =
        ensured.output ??
        (await syncSharedTencentWebARInput(input, outputFps())) ??
        getSharedTencentWebAROutputStream();
      const outTrack = output?.getVideoTracks()[0];
      if (outTrack && outTrack.readyState === 'live') return outTrack;
    } catch {
      /* fall back to raw — live must continue */
    }
    return track;
  }

  async applyPreset(presetId: string): Promise<void> {
    lastPresetId = presetId || 'none';
    lastParams = getTencentBeautifyParams(lastPresetId);
    try {
      await applyCurrentState();
    } catch {
      /* keep last valid processed frame / raw preview */
    }
  }

  updateParameters(values: Record<string, number>): void {
    lastParams = {
      ...lastParams,
      ...values,
    };
    void applyCurrentState().catch(() => undefined);
  }

  setPerformanceTier(next: BeautyPerformanceTier): void {
    tier = next;
    if (lastInput) {
      void syncSharedTencentWebARInput(lastInput, outputFps()).catch(() => undefined);
    }
  }

  async suspend(): Promise<void> {
    if (!consumerHeld) return;
    releaseSharedTencentWebAR();
    consumerHeld = false;
  }

  async resume(): Promise<void> {
    if (consumerHeld) return;
    acquireSharedTencentWebAR();
    consumerHeld = true;
    if (lastInput) {
      try {
        await syncSharedTencentWebARInput(lastInput, outputFps());
        await applyCurrentState();
      } catch {
        /* raw preview remains */
      }
    }
  }

  async dispose(): Promise<void> {
    prepared = false;
    preparing = null;
    lastInput = null;
    lastPresetId = 'none';
    lastParams = { ...BEAUTY_OFF_PARAMS };
    if (consumerHeld) {
      releaseSharedTencentWebAR();
      consumerHeld = false;
    }
  }
}

let adapter: BeautyEngineAdapter | null = null;

export function getBeautyEngineAdapter(): BeautyEngineAdapter {
  if (!adapter) adapter = new TencentBeautyEngineAdapter();
  return adapter;
}

/** Test helper — do not use from presentation. */
export function resetBeautyEngineAdapterForTests(): void {
  adapter = null;
  prepared = false;
  preparing = null;
  consumerHeld = false;
  lastInput = null;
  lastPresetId = 'none';
  lastParams = { ...BEAUTY_OFF_PARAMS };
  tier = 'standard';
}
