import { rollbackRequestSchema } from "@workspace/api-zod";
import { getChangeSet } from "./changeSetService";
import { listChangeSets } from "./changeSetService";
import { newId, nowIso, store, type PublishJobRow } from "./repositories/memoryStore";
import { detectAdminEnvironment } from "./adminIdentityService";

export function rollbackChangeSet(id: string, input: unknown, actorId: string): PublishJobRow {
  const rec = getChangeSet(id);
  const body = rollbackRequestSchema.parse(input);
  if (body.expectedRevision !== rec.revision) {
    throw Object.assign(new Error("stale revision"), { status: 409, code: "error.conflict" });
  }
  if (body.confirmName !== rec.title && body.confirmName !== rec.changeSetKey) {
    throw Object.assign(new Error("confirmation mismatch"), { status: 400, code: "error.conflict" });
  }
  if (rec.targetEnvironment === "production" && detectAdminEnvironment() !== "production") {
    throw Object.assign(new Error("production rollback cannot run from local/test"), { status: 409, code: "error.conflict" });
  }
  const existing = store.idempotency.get(body.idempotencyKey);
  if (existing) {
    const job = store.jobs.get(existing);
    if (job) return job;
  }
  const prior = listChangeSets(rec.targetEnvironment).find(
    (c) => c.id !== rec.id && c.status === "published" && c.publishedSnapshotId,
  );
  if (!prior || !prior.publishedSnapshotId) {
    throw Object.assign(new Error("no prior published version"), { status: 409, code: "error.conflict" });
  }
  rec.status = "rolled_back";
  rec.rolledBackAt = nowIso();
  rec.updatedAt = nowIso();
  rec.rollbackOfId = prior.id;
  const job: PublishJobRow = {
    id: newId(),
    changeSetId: rec.id,
    targetEnvironment: rec.targetEnvironment,
    idempotencyKey: body.idempotencyKey,
    status: "succeeded",
    startedBy: actorId,
    startedAt: nowIso(),
    completedAt: nowIso(),
    resultSnapshotId: prior.publishedSnapshotId,
    resultConfigVersionId: prior.publishedConfigVersionId,
    failureCode: null,
    rollbackOfJobId: [...store.jobs.values()].find((j) => j.changeSetId === rec.id && j.status === "succeeded")?.id || null,
  };
  store.jobs.set(job.id, job);
  store.idempotency.set(body.idempotencyKey, job.id);
  return job;
}
