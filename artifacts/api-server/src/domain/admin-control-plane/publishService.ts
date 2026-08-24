import { publishRequestSchema } from "@workspace/api-zod";
import { currentApproval } from "./approvalService";
import { getChangeSet, transition } from "./changeSetService";
import { listItems } from "./changeItemService";
import { newId, nowIso, store, type PublishJobRow } from "./repositories/memoryStore";
import { detectAdminEnvironment } from "./adminIdentityService";

export function getPublishJob(id: string): PublishJobRow {
  const rec = store.jobs.get(id);
  if (!rec) throw Object.assign(new Error("not found"), { status: 404, code: "error.notFound" });
  return rec;
}

export function publishChangeSet(id: string, input: unknown, actorId: string): PublishJobRow {
  const rec = getChangeSet(id);
  const body = publishRequestSchema.parse(input);
  if (body.expectedRevision !== rec.revision) {
    throw Object.assign(new Error("stale revision"), { status: 409, code: "error.conflict" });
  }
  if (body.confirmName !== rec.title && body.confirmName !== rec.changeSetKey) {
    throw Object.assign(new Error("confirmation mismatch"), { status: 400, code: "error.conflict" });
  }
  if (body.targetEnvironment !== rec.targetEnvironment) {
    throw Object.assign(new Error("environment mismatch"), { status: 400, code: "error.conflict" });
  }
  if (body.targetEnvironment === "production" && detectAdminEnvironment() !== "production") {
    throw Object.assign(new Error("production publication cannot run from local/test"), { status: 409, code: "error.conflict" });
  }
  const existingJobId = store.idempotency.get(body.idempotencyKey);
  if (existingJobId) return getPublishJob(existingJobId);

  const approval = currentApproval(id);
  if (!approval.approved || !approval.approvalMatchesRevision) {
    throw Object.assign(new Error("approval is not current for this revision"), { status: 409, code: "error.conflict" });
  }
  if (rec.status !== "approved" && rec.status !== "publish_failed") {
    throw Object.assign(new Error("not approved"), { status: 409, code: "error.conflict" });
  }

  transition(rec, rec.status === "publish_failed" ? "publishing" : "publishing", actorId);
  const job: PublishJobRow = {
    id: newId(),
    changeSetId: id,
    targetEnvironment: rec.targetEnvironment,
    idempotencyKey: body.idempotencyKey,
    status: "running",
    startedBy: actorId,
    startedAt: nowIso(),
    completedAt: null,
    resultSnapshotId: null,
    resultConfigVersionId: null,
    failureCode: null,
    rollbackOfJobId: null,
  };
  store.jobs.set(job.id, job);
  store.idempotency.set(body.idempotencyKey, job.id);

  try {
    const items = listItems(id);
    if (!items.length) throw new Error("empty_change_set");
    const snapshotId = `snapshot.published.${rec.changeSetKey}.v${rec.revision}`;
    const configVersionId = rec.baseConfigVersionId ? `${rec.baseConfigVersionId}+${rec.revision}` : `config.${rec.changeSetKey}.${rec.revision}`;
    rec.publishedSnapshotId = snapshotId;
    rec.publishedConfigVersionId = configVersionId;
    rec.publishedAt = nowIso();
    transition(rec, "published", actorId, {
      publishedSnapshotId: snapshotId,
      publishedConfigVersionId: configVersionId,
      publishedAt: rec.publishedAt,
    });
    job.status = "succeeded";
    job.completedAt = nowIso();
    job.resultSnapshotId = snapshotId;
    job.resultConfigVersionId = configVersionId;
    return job;
  } catch (err) {
    rec.status = "publish_failed";
    rec.updatedAt = nowIso();
    job.status = "failed";
    job.completedAt = nowIso();
    job.failureCode = err instanceof Error ? err.message : "publish_failed";
    return job;
  }
}
