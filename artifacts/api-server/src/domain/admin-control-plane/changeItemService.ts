import { upsertChangeItemRequestSchema } from "@workspace/api-zod";
import { validateAdminPatch } from "./validators/forbiddenPayload";
import { getChangeSet } from "./changeSetService";
import { newId, nowIso, store, type ChangeItemRow } from "./repositories/memoryStore";

export function listItems(changeSetId: string): ChangeItemRow[] {
  return [...store.items.values()].filter((i) => i.changeSetId === changeSetId);
}

export function addOrUpdateItem(changeSetId: string, input: unknown, actorId: string): ChangeItemRow {
  const rec = getChangeSet(changeSetId);
  if (!["draft", "invalid", "valid", "preview_ready", "rejected", "approved", "pending_review"].includes(rec.status)) {
    throw Object.assign(new Error("cannot edit items"), { status: 409, code: "error.conflict" });
  }
  const body = upsertChangeItemRequestSchema.parse(input);
  if (body.expectedRevision && body.expectedRevision !== rec.revision) {
    throw Object.assign(new Error("stale revision"), { status: 409, code: "error.conflict" });
  }
  const issues = validateAdminPatch(body.patch);
  if (issues.length) {
    throw Object.assign(new Error(issues[0]!.message), { status: 400, code: issues[0]!.code, issues });
  }
  const existing = listItems(changeSetId).find((i) => i.resourceType === body.resourceType && i.resourceId === body.resourceId);
  const row: ChangeItemRow = existing ?? {
    id: newId(),
    changeSetId,
    resourceType: body.resourceType,
    resourceId: body.resourceId,
    baseVersion: rec.baseSnapshotId,
    draftVersion: 1,
    operation: body.operation,
    patchJson: {},
    dependencyJson: {},
    validationStatus: "pending",
    validationIssues: [],
    createdBy: actorId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  row.operation = body.operation;
  row.patchJson = body.patch;
  row.draftVersion = existing ? existing.draftVersion + 1 : 1;
  row.validationStatus = "pending";
  row.validationIssues = [];
  row.updatedAt = nowIso();
  store.items.set(row.id, row);
  rec.revision += 1;
  rec.updatedAt = nowIso();
  rec.status = "draft";
  rec.approvedAt = null;
  rec.submittedAt = null;
  return row;
}

export function deleteItem(changeSetId: string, itemId: string, actorId: string): void {
  const rec = getChangeSet(changeSetId);
  const item = store.items.get(itemId);
  if (!item || item.changeSetId !== changeSetId) {
    throw Object.assign(new Error("not found"), { status: 404, code: "error.notFound" });
  }
  if (rec.createdBy !== actorId && rec.status !== "draft") {
    /* still allow owner/editor via route permission */
  }
  if (!["draft", "invalid", "valid", "rejected"].includes(rec.status)) {
    throw Object.assign(new Error("cannot delete items"), { status: 409, code: "error.conflict" });
  }
  store.items.delete(itemId);
  rec.revision += 1;
  rec.status = "draft";
  rec.approvedAt = null;
  rec.updatedAt = nowIso();
}
