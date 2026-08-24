import type { DeviceTier } from "./capabilityProfile";

export type PreloadPlan = {
  metadataOnly: string[];
  thumbnails: string[];
  effects: string[];
};

export function planPreload(input: {
  visibleResourceIds: string[];
  likelyResourceIds?: string[];
  tier: DeviceTier;
  offline?: boolean;
}): PreloadPlan {
  if (input.offline || input.tier === "tier-0-static") {
    return { metadataOnly: input.visibleResourceIds, thumbnails: [], effects: [] };
  }
  return {
    metadataOnly: input.visibleResourceIds,
    thumbnails: input.visibleResourceIds.slice(0, 12),
    effects: input.tier === "tier-3-high" ? (input.likelyResourceIds || []).slice(0, 2) : [],
  };
}
