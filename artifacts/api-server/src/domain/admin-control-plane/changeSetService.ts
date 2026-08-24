import type { AdminEnvironment, ChangeSetStatus } from "@workspace/api-zod";
import { createChangeSetRequestSchema, patchChangeSetRequestSchema } from "@workspace/api-zod";
import { appendAudit } from "./auditService";
import { newId, nowIso, store, type ChangeSetRow } from "./repositories/memoryStore";

const EDITABLE: ChangeSetStatus[] = ["draft", "invalid", "valid", "preview_ready", "rejected", "approved", "pending_review"];
const SUBMIT_FROM: ChangeSetStatus[] = ["valid", "preview_ready"];

export const TRANSITIONS: Record<string, ChangeSetStatus[]> = {
  draft: ["validating", "cancelled"],
  validating: ["invalid", "valid"],
  invalid: ["draft", "validating", "cancelled"],
  valid: ["preview_ready", "pending_review", "validating", "draft", "cancelled"],
  preview_ready: ["pending_review", "validating", "draft", "cancelled"],
  pending_review: ["approved", "rejected", "cancelled"],
  approved: ["publishing", "draft"],
  publishing: ["published", "publish_failed"],
  published: ["rolled_back", "superseded"],
  rejected: ["draft", "cancelled"],
  cancelled: [],
  publish_failed: ["draft", "publishing", "cancelled"],
  rolled_back: [],
  superseded: [],
};

export function listChangeSets(environment?: AdminEnvironment): ChangeSetRow[] {
  const all = [...store.changeSets.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return environment ? all.filter((c) => c.targetEnvironment === environment) : all;
}

export function getChangeSet(id: string): ChangeSetRow {
  const rec = store.changeSets.get(id);
  if (!rec) throw Object.assign(new Error("not found"), { status: 404, code: "error.notFound" });
  return rec;
}

export function createChangeSet(input: unknown, actorId: string): ChangeSetRow {
  const body = createChangeSetRequestSchema.parse(input);
  const rec: ChangeSetRow = {
    id: newId(),
    changeSetKey: `cs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title: body.title,
    description: body.description || "",
    targetEnvironment: body.targetEnvironment,
    status: "draft",
    baseSnapshotId: body.baseSnapshotId,
    baseConfigVersionId: body.baseConfigVersionId || null,
    createdBy: actorId,
    revision: 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    submittedAt: null,
    approvedAt: null,
    publishedAt: null,
    rolledBackAt: null,
    previewSnapshotId: null,
    publishedSnapshotId: null,
    publishedConfigVersionId: null,
    rollbackOfId: null,
  };
  store.changeSets.set(rec.id, rec);
  appendAudit({
    actorUserId: actorId,
    actorSessionId: null,
    action: "change_set.create",
    resourceType: "admin.change_set",
    resourceId: rec.id,
    environment: rec.targetEnvironment,
    beforeVersion: null,
    afterVersion: String(rec.revision),
    changeSetId: rec.id,
    requestId: null,
    safeMetadata: { title: rec.title, baseSnapshotId: rec.baseSnapshotId },
  });
  return rec;
}

export function patchChangeSet(id: string, input: unknown, actorId: string, canEditAny: boolean): ChangeSetRow {
  const rec = getChangeSet(id);
  if (!canEditAny && rec.createdBy !== actorId) {
    throw Object.assign(new Error("forbidden"), { status: 403, code: "error.forbidden" });
  }
  if (!EDITABLE.includes(rec.status)) {
    throw Object.assign(new Error("immutable status"), { status: 409, code: "error.conflict" });
  }
  const body = patchChangeSetRequestSchema.parse(input);
  if (body.expectedRevision !== rec.revision) {
    throw Object.assign(new Error("stale revision"), { status: 409, code: "error.conflict" });
  }
  rec.title = body.title ?? rec.title;
  rec.description = body.description ?? rec.description;
  rec.revision += 1;
  rec.updatedAt = nowIso();
  if (rec.status === "approved" || rec.status === "pending_review" || rec.status === "preview_ready" || rec.status === "valid") {
    rec.status = "draft";
    rec.approvedAt = null;
    rec.submittedAt = null;
  }
  appendAudit({
    actorUserId: actorId,
    actorSessionId: null,
    action: "change_set.edit",
    resourceType: "admin.change_set",
    resourceId: rec.id,
    environment: rec.targetEnvironment,
    beforeVersion: String(body.expectedRevision),
    afterVersion: String(rec.revision),
    changeSetId: rec.id,
    requestId: null,
    safeMetadata: {},
  });
  return rec;
}

export function transition(rec: ChangeSetRow, next: ChangeSetStatus, actorId: string, extra: Partial<ChangeSetRow> = {}): ChangeSetRow {
  const allowed = TRANSITIONS[rec.status] || [];
  if (!allowed.includes(next)) {
    throw Object.assign(new Error(`illegal transition ${rec.status} → ${next}`), { status: 409, code: "error.conflict" });
  }
  rec.status = next;
  rec.updatedAt = nowIso();
  Object.assign(rec, extra);
  appendAudit({
    actorUserId: actorId,
    actorSessionId: null,
    action: `change_set.${next}`,
    resourceType: "admin.change_set",
    resourceId: rec.id,
    environment: rec.targetEnvironment,
    beforeVersion: String(rec.revision),
    afterVersion: String(rec.revision),
    changeSetId: rec.id,
    requestId: null,
    safeMetadata: { status: next },
  });
  return rec;
}

export function submitChangeSet(id: string, actorId: string, expectedRevision: number): ChangeSetRow {
  const rec = getChangeSet(id);
  if (expectedRevision !== rec.revision) throw Object.assign(new Error("stale revision"), { status: 409, code: "error.conflict" });
  if (!SUBMIT_FROM.includes(rec.status)) {
    throw Object.assign(new Error("cannot submit until validated"), { status: 409, code: "error.conflict" });
  }
  rec.submittedAt = nowIso();
  return transition(rec, "pending_review", actorId, { submittedAt: rec.submittedAt });
}

export function cancelChangeSet(id: string, actorId: string): ChangeSetRow {
  const rec = getChangeSet(id);
  return transition(rec, "cancelled", actorId);
}
