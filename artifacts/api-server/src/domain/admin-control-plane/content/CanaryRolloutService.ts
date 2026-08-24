import { newId, nowIso, store } from "../repositories/memoryStore";
import { appendAudit } from "../auditService";

const STAGES = ["admin_preview", "internal", "small_canary", "expanded_canary", "full"] as const;
export type RolloutStage = (typeof STAGES)[number];

const THRESHOLDS = {
  errorRatePct: 0.5,
  fallbackRatePct: 2,
  bundleLoadFailurePct: 1,
};

export function createCanary(changeSetId: string, actorId: string) {
  const row = {
    id: newId(),
    changeSetId,
    stage: "admin_preview" as RolloutStage,
    status: "active",
    paused: false,
    metrics: { errorRatePct: 0, fallbackRatePct: 0, bundleLoadFailurePct: 0 },
    createdBy: actorId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  store.rollouts.set(row.id, row);
  appendAudit({
    actorUserId: actorId,
    actorSessionId: null,
    action: "rollout.create",
    resourceType: "runtime.bundle",
    resourceId: changeSetId,
    environment: "local",
    beforeVersion: null,
    afterVersion: row.id,
    changeSetId,
    requestId: null,
    safeMetadata: { stage: row.stage },
  });
  return row;
}

export function advanceCanary(id: string, actorId: string) {
  const row = requireRollout(id);
  if (row.paused || row.status === "stopped") {
    throw Object.assign(new Error("rollout paused"), { status: 409, code: "rollout.paused" });
  }
  const idx = STAGES.indexOf(row.stage as RolloutStage);
  if (idx < 0 || idx >= STAGES.length - 1) {
    throw Object.assign(new Error("cannot advance"), { status: 409, code: "rollout.stage" });
  }
  evaluateThresholds(row);
  row.stage = STAGES[idx + 1];
  row.updatedAt = nowIso();
  store.rollouts.set(id, row);
  appendAudit({
    actorUserId: actorId,
    actorSessionId: null,
    action: "rollout.advance",
    resourceType: "runtime.bundle",
    resourceId: String(row.changeSetId),
    environment: "local",
    beforeVersion: null,
    afterVersion: String(row.stage),
    changeSetId: String(row.changeSetId),
    requestId: null,
    safeMetadata: { stage: row.stage },
  });
  return row;
}

export function pauseCanary(id: string, actorId: string) {
  const row = requireRollout(id);
  row.paused = true;
  row.status = "paused";
  row.updatedAt = nowIso();
  store.rollouts.set(id, row);
  appendAudit({ actorUserId: actorId, actorSessionId: null, action: "rollout.pause", resourceType: "runtime.bundle", resourceId: id, environment: "local", beforeVersion: null, afterVersion: id, changeSetId: null, requestId: null, safeMetadata: {} });
  return row;
}

export function resumeCanary(id: string, actorId: string) {
  const row = requireRollout(id);
  row.paused = false;
  row.status = "active";
  row.updatedAt = nowIso();
  store.rollouts.set(id, row);
  appendAudit({ actorUserId: actorId, actorSessionId: null, action: "rollout.resume", resourceType: "runtime.bundle", resourceId: id, environment: "local", beforeVersion: null, afterVersion: id, changeSetId: null, requestId: null, safeMetadata: {} });
  return row;
}

export function reportCanaryMetrics(id: string, metrics: Record<string, number>) {
  const row = requireRollout(id);
  row.metrics = { ...row.metrics, ...metrics };
  evaluateThresholds(row);
  row.updatedAt = nowIso();
  store.rollouts.set(id, row);
  return row;
}

export function getCanary(id: string) {
  return requireRollout(id);
}

function requireRollout(id: string) {
  const row = store.rollouts.get(id) as Record<string, unknown> | undefined;
  if (!row) throw Object.assign(new Error("not found"), { status: 404, code: "error.notFound" });
  return row as typeof row & { stage: string; paused: boolean; status: string; metrics: Record<string, number>; changeSetId: string };
}

function evaluateThresholds(row: { metrics: Record<string, number>; paused: boolean; status: string }) {
  if (
    Number(row.metrics.errorRatePct || 0) > THRESHOLDS.errorRatePct ||
    Number(row.metrics.fallbackRatePct || 0) > THRESHOLDS.fallbackRatePct ||
    Number(row.metrics.bundleLoadFailurePct || 0) > THRESHOLDS.bundleLoadFailurePct
  ) {
    row.paused = true;
    row.status = "stopped";
  }
}
