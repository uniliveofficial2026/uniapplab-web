import { sessionAssignmentRequestSchema } from "@workspace/api-zod";
import { listChangeSets } from "./changeSetService";
import { newId, nowIso, store, type SessionAssignmentRow } from "./repositories/memoryStore";

export function listAssignments(): SessionAssignmentRow[] {
  return [...store.assignments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createAssignment(input: unknown, actorId: string): SessionAssignmentRow {
  const body = sessionAssignmentRequestSchema.parse(input);
  const published = listChangeSets().some(
    (c) => c.publishedSnapshotId === body.snapshotId && (c.status === "published" || c.status === "rolled_back"),
  );
  const previewOk = body.sessionType === "admin_preview" && body.snapshotId.startsWith("snapshot.admin-preview.");
  const bundled = body.snapshotId === "snapshot.bundled.default";
  if (!published && !previewOk && !bundled) {
    throw Object.assign(new Error("assignment requires published or preview snapshot"), { status: 409, code: "error.conflict" });
  }
  const row: SessionAssignmentRow = {
    id: newId(),
    snapshotId: body.snapshotId,
    sessionType: body.sessionType,
    platform: body.platform || "all",
    applyPolicy: body.applyPolicy || "immediate_safe",
    createdBy: actorId,
    active: true,
    expiresAt: body.expiresAt || null,
    createdAt: nowIso(),
  };
  store.assignments.push(row);
  return row;
}

export function disableAssignment(id: string, actorId: string): SessionAssignmentRow {
  const rec = store.assignments.find((a) => a.id === id);
  if (!rec) throw Object.assign(new Error("not found"), { status: 404, code: "error.notFound" });
  rec.active = false;
  rec.createdBy = rec.createdBy || actorId;
  return rec;
}
