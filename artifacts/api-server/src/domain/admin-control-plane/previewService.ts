import { getChangeSet, transition } from "./changeSetService";
import { newId, nowIso, store, type PreviewSessionRow } from "./repositories/memoryStore";

export function createPreview(changeSetId: string, actorId: string): PreviewSessionRow {
  const rec = getChangeSet(changeSetId);
  if (!["valid", "preview_ready", "pending_review", "approved"].includes(rec.status)) {
    throw Object.assign(new Error("preview requires valid change set"), { status: 409, code: "error.conflict" });
  }
  const snapshotId = `snapshot.admin-preview.${rec.changeSetKey}.r${rec.revision}`;
  const row: PreviewSessionRow = {
    id: newId(),
    changeSetId,
    snapshotId,
    createdBy: actorId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    createdAt: nowIso(),
  };
  store.previews.push(row);
  rec.previewSnapshotId = snapshotId;
  if (rec.status === "valid") transition(rec, "preview_ready", actorId, { previewSnapshotId: snapshotId });
  else rec.updatedAt = nowIso();
  return row;
}

export function listPreviews(changeSetId?: string): PreviewSessionRow[] {
  return changeSetId ? store.previews.filter((p) => p.changeSetId === changeSetId) : [...store.previews];
}
