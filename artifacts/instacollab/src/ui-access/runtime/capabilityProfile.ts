export type DeviceTier = "tier-0-static" | "tier-1-low" | "tier-2-medium" | "tier-3-high";

export type CapabilitySnapshot = {
  platform: "web" | "ios" | "android";
  appVersion: string;
  reducedMotion: boolean;
  powerSave: boolean;
  decodeSupport: { svga: boolean; webm: boolean; gif: boolean; lottie: boolean };
  rendererSupport: string[];
  coarseMemoryMb: number | null;
  network: "offline" | "slow-3g" | "4g" | "wifi" | "unknown";
};

export function detectCapability(input?: Partial<CapabilitySnapshot>): CapabilitySnapshot {
  const reducedMotion =
    input?.reducedMotion ??
    (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) ??
    false;
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const connection = (nav as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } } | undefined)?.connection;
  const memory = (nav as Navigator & { deviceMemory?: number } | undefined)?.deviceMemory;
  return {
    platform: input?.platform || "web",
    appVersion: input?.appVersion || "0.0.0",
    reducedMotion: Boolean(reducedMotion),
    powerSave: Boolean(input?.powerSave ?? connection?.saveData),
    decodeSupport: input?.decodeSupport || { svga: true, webm: true, gif: true, lottie: false },
    rendererSupport: input?.rendererSupport || ["renderer.gift.svga.v1", "renderer.gift.video.v1", "renderer.gift.static.v1"],
    coarseMemoryMb: input?.coarseMemoryMb ?? (typeof memory === "number" ? memory * 1024 : null),
    network: input?.network || inferNetwork(connection?.effectiveType),
  };
}

function inferNetwork(effectiveType?: string): CapabilitySnapshot["network"] {
  if (!effectiveType) return "unknown";
  if (effectiveType.includes("2g") || effectiveType === "slow-2g") return "slow-3g";
  if (effectiveType.includes("3g")) return "slow-3g";
  if (effectiveType.includes("4g")) return "4g";
  return "wifi";
}

export function selectTier(cap: CapabilitySnapshot): DeviceTier {
  if (cap.reducedMotion || cap.network === "offline") return "tier-0-static";
  if (cap.powerSave || (cap.coarseMemoryMb != null && cap.coarseMemoryMb < 2048) || cap.network === "slow-3g") return "tier-1-low";
  if (cap.coarseMemoryMb != null && cap.coarseMemoryMb >= 6144) return "tier-3-high";
  return "tier-2-medium";
}
