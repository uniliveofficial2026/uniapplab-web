import type { DeviceTier } from "./capabilityProfile";

export type PerformanceProfileId = `perf.${DeviceTier}`;

export const PERFORMANCE_TARGETS = {
  lcpMs: 2500,
  inpMs: 200,
  cls: 0.1,
  mainThreadLongTaskMs: 50,
  tapFeedbackMs: 100,
  highTierFps: 60,
  lowTierFps: 30,
} as const;

export function profileIdForTier(tier: DeviceTier): PerformanceProfileId {
  return `perf.${tier}`;
}
