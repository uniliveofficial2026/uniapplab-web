import { resolveUiAssignment, type AssignmentContext, type AssignmentDecision } from "../../uiConfig/assignmentResolve";
import { getLiveUiRegistry } from "./LiveUiAccessService";

export type LiveExperienceResolveRequest = {
  appSessionId: string;
  liveRoomSessionId?: string | null;
  roomId?: string | null;
  canonicalRoomType: string;
  uiRoomMode?: string | null;
  appVersion?: string;
  platform?: string;
  isAdminPreview?: boolean;
  previewSnapshotId?: string | null;
  userId?: string | null;
};

export function resolveLiveExperienceAssignment(input: LiveExperienceResolveRequest): AssignmentDecision & {
  experienceId: string | null;
  assignmentReason: string;
} {
  const registry = getLiveUiRegistry() as {
    experiences: Array<{ experienceId: string; canonicalRoomTypes: string[]; uiRoomModes: string[] }>;
  };
  const mode = input.uiRoomMode || "";
  const rec =
    registry.experiences.find((e) => e.canonicalRoomTypes.includes(input.canonicalRoomType) && (!mode || e.uiRoomModes.includes(mode))) ||
    registry.experiences.find((e) => e.canonicalRoomTypes.includes(input.canonicalRoomType)) ||
    null;
  const ctx: AssignmentContext = {
    sessionType: input.isAdminPreview ? "admin_preview" : "live_room",
    isAdminPreview: Boolean(input.isAdminPreview),
    userId: input.userId || null,
    roomId: input.roomId || null,
    roomType: input.canonicalRoomType,
    platform: input.platform || "web",
    appVersion: input.appVersion || "0.0.0",
    previewSnapshotId: input.previewSnapshotId || null,
  };
  const decision = resolveUiAssignment(ctx, []);
  const reason =
    decision.source === "admin_preview"
      ? "admin-preview"
      : decision.source === "live_room"
        ? "live-room-session"
        : decision.source === "experiment"
          ? "canary-cohort"
          : decision.source === "bundled"
            ? "bundled-fallback"
            : decision.source === "global"
              ? "global-published"
              : decision.source;
  return { ...decision, experienceId: rec?.experienceId || null, assignmentReason: reason };
}
