export type RuntimePlatform = "web" | "ios" | "android";

export type RuntimeResourceReference = {
  type: string;
  id: string;
  version?: number;
};

export type RuntimeVariant = {
  qualityTier: "tier-0-static" | "tier-1-low" | "tier-2-medium" | "tier-3-high";
  platform: RuntimePlatform;
  format: string;
  width?: number;
  height?: number;
  durationMs?: number;
  byteSize: number;
  checksum: string;
  deliveryPath: string;
  decodeRequirement: string;
  memoryEstimateBytes: number;
  frameRateTarget: number;
  fallbackVariantId?: string;
};

export type RuntimeResource = {
  resourceId: string;
  resourceType: string;
  version: number;
  schemaVersion: number;
  rendererId: string;
  rendererVersionRange: string;
  dependencies: RuntimeResourceReference[];
  variants: RuntimeVariant[];
  fallbackResourceId: string;
  capabilityProfileIds: string[];
  performanceProfileId: string;
  platforms: RuntimePlatform[];
  localeSupport: string[];
  checksum: string;
  byteSize: number;
  status: "published";
};

export function assertPublishedOnly(status: string): void {
  if (status !== "published") {
    throw Object.assign(new Error("draft resources are not customer-deliverable"), { status: 403, code: "resource.draft" });
  }
}
