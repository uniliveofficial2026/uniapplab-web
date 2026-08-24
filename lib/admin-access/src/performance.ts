export type DeviceTier = "tier-0-static" | "tier-1-low" | "tier-2-medium" | "tier-3-high";

export type PerformanceProfile = {
  profileId: string;
  platforms: Array<"web" | "ios" | "android">;
  deviceTiers: DeviceTier[];
  networkProfiles: string[];
  compressedBytes: number;
  decodedWidth?: number;
  decodedHeight?: number;
  durationMs?: number;
  decodeTimeMs?: number;
  initializationTimeMs?: number;
  frameTimingMs?: number;
  droppedFrameRate?: number;
  memoryEstimateBytes?: number;
  cleanupOk: boolean;
  fallbackOk: boolean;
};

export const WEB_P75 = { lcpMs: 2500, inpMs: 200, cls: 0.1 } as const;
export const MAIN_THREAD_LONG_TASK_MS = 50;
export const TAP_FEEDBACK_MS = 100;

const OVERRIDE_NEVER = new Set(["secretExposure", "malformedContent", "authorizationFailure"]);

export function canOverrideGate(gate: string): boolean {
  return !OVERRIDE_NEVER.has(gate);
}

export function selectDeviceTier(input: {
  reducedMotion?: boolean;
  powerSave?: boolean;
  decodeSupport?: boolean;
  rendererSupport?: boolean;
  coarseMemoryMb?: number;
}): DeviceTier {
  if (input.reducedMotion || input.decodeSupport === false || input.rendererSupport === false) return "tier-0-static";
  if (input.powerSave || (typeof input.coarseMemoryMb === "number" && input.coarseMemoryMb < 2048)) return "tier-1-low";
  if (typeof input.coarseMemoryMb === "number" && input.coarseMemoryMb >= 6144) return "tier-3-high";
  return "tier-2-medium";
}
