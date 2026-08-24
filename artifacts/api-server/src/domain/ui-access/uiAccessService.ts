import { resolveUiAssignment, BUNDLED_SNAPSHOT_ID, type AssignmentContext, type AssignmentRule } from "./uiAssignmentService";
import { activateSnapshotAtomically } from "./uiSnapshotService";
import { visualSnapshotMayOverride } from "./uiAccessPolicy";

export function resolveSessionUiAccess(ctx: AssignmentContext, rules: AssignmentRule[]) {
  const decision = resolveUiAssignment(ctx, rules);
  return {
    snapshotId: decision.snapshotId || BUNDLED_SNAPSHOT_ID,
    source: decision.source,
    applyPolicy: decision.applyPolicy,
    pin: true,
    localeHonored: true,
    reducedMotionHonored: true,
    cannotOverrideBackend: !visualSnapshotMayOverride("wallet.balance"),
  };
}

export function activateAssignedLockfile(lockfile: Record<string, unknown>) {
  return activateSnapshotAtomically(lockfile);
}
