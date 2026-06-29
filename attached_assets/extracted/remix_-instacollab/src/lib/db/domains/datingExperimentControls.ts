import type {
  ExperimentPresetAudit,
  ExperimentStability,
} from './datingExperimentUtils';

export type ExperimentPresetName = 'conservative' | 'balanced' | 'aggressive';

export function normalizeExperimentStabilityPatch(
  patch: {
    cooldownMinutes?: number;
    minHoldMinutes?: number;
    minExposurePerBucket?: number;
    confidenceThreshold?: number;
    minDelta?: number;
  },
  fallback: ExperimentStability
): ExperimentStability {
  return {
    cooldownMinutes: Math.max(
      5,
      Math.min(180, Number(patch.cooldownMinutes ?? fallback.cooldownMinutes))
    ),
    minHoldMinutes: Math.max(
      15,
      Math.min(24 * 60, Number(patch.minHoldMinutes ?? fallback.minHoldMinutes))
    ),
    minExposurePerBucket: Math.max(
      8,
      Math.min(2000, Number(patch.minExposurePerBucket ?? fallback.minExposurePerBucket))
    ),
    confidenceThreshold: Math.max(
      0.5,
      Math.min(0.999, Number(patch.confidenceThreshold ?? fallback.confidenceThreshold))
    ),
    minDelta: Math.max(0, Math.min(0.2, Number(patch.minDelta ?? fallback.minDelta))),
  };
}

export function getExperimentPresetStability(
  preset: ExperimentPresetName
): {
  minExposurePerBucket: number;
  confidenceThreshold: number;
  minDelta: number;
  cooldownMinutes: number;
  minHoldMinutes: number;
} {
  if (preset === 'conservative') {
    return {
      minExposurePerBucket: 80,
      confidenceThreshold: 0.98,
      minDelta: 0.035,
      cooldownMinutes: 45,
      minHoldMinutes: 120,
    };
  }
  if (preset === 'aggressive') {
    return {
      minExposurePerBucket: 20,
      confidenceThreshold: 0.9,
      minDelta: 0.01,
      cooldownMinutes: 10,
      minHoldMinutes: 30,
    };
  }
  return {
    minExposurePerBucket: 30,
    confidenceThreshold: 0.95,
    minDelta: 0.02,
    cooldownMinutes: 20,
    minHoldMinutes: 60,
  };
}

export function buildExperimentPresetAudit(params: {
  preset: ExperimentPresetName;
  now: number;
  actorUserId: string | null;
}): ExperimentPresetAudit {
  return {
    lastPreset: params.preset,
    lastAppliedAt: params.now,
    lastAppliedBy: params.actorUserId,
  };
}
