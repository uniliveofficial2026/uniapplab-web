/**
 * UniLive’s live experience contracts.
 * Presentation IDs only. Canonical room types stay on the backend.
 */

export const LIVE_EXPERIENCE_IDS = [
  "experience.live.solo-audio",
  "experience.live.solo-video",
  "experience.live.multi-guest-audio",
  "experience.live.multi-guest-video",
  "experience.live.party-audio",
  "experience.live.party-video",
  "experience.live.pk-1v1",
  "experience.live.pk-team",
] as const;

export type LiveExperienceId = (typeof LIVE_EXPERIENCE_IDS)[number];

export type LiveMediaMode = "audio" | "video" | "mixed";

export type LiveBackendStatus = "supported" | "supported-via-alias" | "unsupported";

export type LiveAssignmentReason =
  | "admin-preview"
  | "live-room-session"
  | "room"
  | "canary-cohort"
  | "device-locale-app"
  | "global-published"
  | "bundled-fallback";

export type LiveUnsafeBoundary =
  | "room-connection"
  | "reconnection"
  | "media-publication"
  | "seat-movement"
  | "seat-acceptance"
  | "pk-countdown"
  | "pk-score-settlement"
  | "gift-purchase"
  | "gift-effect-playback"
  | "moderation-confirmation"
  | "room-ending";

export interface LiveExperienceManifest {
  schemaVersion: number;
  experienceId: LiveExperienceId;
  displayName: string;
  canonicalRoomTypes: string[];
  mediaMode: LiveMediaMode;
  versionId: string;
  layoutVersionId: string;
  nodeVersionIds: Record<string, string>;
  translationNamespaceIds: string[];
  themeTokenSetId: string;
  requiredCapabilities: string[];
  minimumAppVersion: string;
  fallbackExperienceId: LiveExperienceId;
  checksum: string;
}

export interface LiveNodeDefinition {
  nodeId: string;
  displayName: string;
  sourcePath: string;
  componentId: string;
  allowedComponentIds: string[];
  allowedExperienceIds: LiveExperienceId[];
  bindingIds: string[];
  actionIds: string[];
  required: boolean;
  replaceable: boolean;
  removable: boolean;
  translationKeys: string[];
  assetIds: string[];
  childSlotIds: string[];
  performanceClass?: "chrome" | "decorative" | "media-critical" | "high-frequency";
  template?: boolean;
  fallbackNodeId?: string;
}

export interface ResolvedLiveExperienceSnapshot {
  appSessionId: string;
  liveRoomSessionId: string;
  roomId: string;
  canonicalRoomType: string;
  experienceId: LiveExperienceId;
  experienceVersionId: string;
  layoutVersionId: string;
  nodeVersionIds: Record<string, string>;
  assetVersionIds: Record<string, string>;
  translationBundleVersion: string;
  checksum: string;
  assignmentReason: LiveAssignmentReason;
}

export const LIVE_LAYOUT_SLOTS = [
  "background",
  "header",
  "identity",
  "stage",
  "participants",
  "seats",
  "status",
  "comments",
  "reactions",
  "gifts",
  "effects",
  "primary-actions",
  "secondary-actions",
  "navigation",
  "dialogs",
  "system-overlays",
] as const;

export type LiveLayoutSlot = (typeof LIVE_LAYOUT_SLOTS)[number];

export function isLiveExperienceId(value: string): value is LiveExperienceId {
  return (LIVE_EXPERIENCE_IDS as readonly string[]).includes(value);
}

export function liveInstanceKey(templateNodeId: string, entityId: string): string {
  if (!templateNodeId || !entityId) {
    throw new Error("live instance key requires template node + canonical entity id");
  }
  if (/^\d+$/.test(entityId)) {
    throw new Error("live instance keys must not use array indexes");
  }
  return `${templateNodeId}:${entityId}`;
}
