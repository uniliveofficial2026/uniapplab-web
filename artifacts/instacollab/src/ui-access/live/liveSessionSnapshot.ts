import { createHash } from "./checksum";
import type {
  LiveAssignmentReason,
  LiveExperienceId,
  LiveUnsafeBoundary,
  ResolvedLiveExperienceSnapshot,
} from "./contracts";
import { getLiveExperience } from "./liveExperienceRegistry";
import { fallbackLiveSnapshot } from "./liveFallback";

export type LiveSessionAssignmentInput = {
  appSessionId: string;
  liveRoomSessionId?: string | null;
  roomId?: string | null;
  canonicalRoomType?: string | null;
  uiRoomMode?: string | null;
  appVersion?: string | null;
  locale?: string | null;
  deviceClass?: string | null;
  previewSnapshot?: Partial<ResolvedLiveExperienceSnapshot> | null;
  roomSessionSnapshot?: Partial<ResolvedLiveExperienceSnapshot> | null;
  roomSnapshot?: Partial<ResolvedLiveExperienceSnapshot> | null;
  canarySnapshot?: Partial<ResolvedLiveExperienceSnapshot> | null;
  deviceCompatibleSnapshot?: Partial<ResolvedLiveExperienceSnapshot> | null;
  globalPublishedSnapshot?: Partial<ResolvedLiveExperienceSnapshot> | null;
  activeBoundary?: LiveUnsafeBoundary | null;
};

const PRECEDENCE: LiveAssignmentReason[] = [
  "admin-preview",
  "live-room-session",
  "room",
  "canary-cohort",
  "device-locale-app",
  "global-published",
  "bundled-fallback",
];

export const LIVE_UNSAFE_STRUCTURAL_BOUNDARIES: readonly LiveUnsafeBoundary[] = [
  "room-connection",
  "reconnection",
  "media-publication",
  "seat-movement",
  "seat-acceptance",
  "pk-countdown",
  "pk-score-settlement",
  "gift-purchase",
  "gift-effect-playback",
  "moderation-confirmation",
  "room-ending",
];

function hydrate(
  partial: Partial<ResolvedLiveExperienceSnapshot> | null | undefined,
  reason: LiveAssignmentReason,
  input: LiveSessionAssignmentInput,
): ResolvedLiveExperienceSnapshot | null {
  if (!partial?.experienceId) return null;
  const rec = getLiveExperience(partial.experienceId as LiveExperienceId);
  if (!rec) return null;
  const snapshot: ResolvedLiveExperienceSnapshot = {
    appSessionId: input.appSessionId,
    liveRoomSessionId: input.liveRoomSessionId || partial.liveRoomSessionId || "",
    roomId: input.roomId || partial.roomId || "",
    canonicalRoomType: input.canonicalRoomType || rec.canonicalRoomTypes[0],
    experienceId: rec.experienceId,
    experienceVersionId: partial.experienceVersionId || rec.manifest.versionId,
    layoutVersionId: partial.layoutVersionId || rec.manifest.layoutVersionId,
    nodeVersionIds: { ...rec.manifest.nodeVersionIds, ...(partial.nodeVersionIds || {}) },
    assetVersionIds: { ...(partial.assetVersionIds || {}) },
    translationBundleVersion: partial.translationBundleVersion || "published",
    checksum: "",
    assignmentReason: reason,
  };
  snapshot.checksum = createHash(JSON.stringify({
    experienceId: snapshot.experienceId,
    experienceVersionId: snapshot.experienceVersionId,
    layoutVersionId: snapshot.layoutVersionId,
    nodeVersionIds: snapshot.nodeVersionIds,
  }));
  return snapshot;
}

export function resolveLiveExperienceSnapshot(input: LiveSessionAssignmentInput): ResolvedLiveExperienceSnapshot {
  const candidates: Array<[LiveAssignmentReason, Partial<ResolvedLiveExperienceSnapshot> | null | undefined]> = [
    ["admin-preview", input.previewSnapshot],
    ["live-room-session", input.roomSessionSnapshot],
    ["room", input.roomSnapshot],
    ["canary-cohort", input.canarySnapshot],
    ["device-locale-app", input.deviceCompatibleSnapshot],
    ["global-published", input.globalPublishedSnapshot],
  ];
  for (const [reason, partial] of candidates) {
    const snap = hydrate(partial, reason, input);
    if (snap) return snap;
  }
  void PRECEDENCE;
  return fallbackLiveSnapshot({
    appSessionId: input.appSessionId,
    liveRoomSessionId: input.liveRoomSessionId || "",
    roomId: input.roomId || "",
    canonicalRoomType: input.canonicalRoomType || "solo_audio",
  });
}

export function canApplyStructuralLiveUpdate(boundary: LiveUnsafeBoundary | null | undefined): boolean {
  if (!boundary) return true;
  return !LIVE_UNSAFE_STRUCTURAL_BOUNDARIES.includes(boundary);
}

export function applyPendingLiveSnapshot(args: {
  current: ResolvedLiveExperienceSnapshot;
  pending: ResolvedLiveExperienceSnapshot;
  boundary?: LiveUnsafeBoundary | null;
  structural: boolean;
}): { applied: ResolvedLiveExperienceSnapshot; deferred: boolean } {
  if (args.structural && !canApplyStructuralLiveUpdate(args.boundary)) {
    return { applied: args.current, deferred: true };
  }
  if (args.pending.checksum !== args.current.checksum && args.pending.experienceId !== args.current.experienceId && args.structural) {
    if (!canApplyStructuralLiveUpdate(args.boundary)) {
      return { applied: args.current, deferred: true };
    }
  }
  return { applied: args.pending, deferred: false };
}
