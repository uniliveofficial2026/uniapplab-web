import { reviewRequestSchema } from "@workspace/api-zod";
import { getChangeSet, transition } from "./changeSetService";
import { newId, nowIso, store, type ReviewRow } from "./repositories/memoryStore";

export function listReviews(changeSetId: string): ReviewRow[] {
  return store.reviews.filter((r) => r.changeSetId === changeSetId);
}

export function reviewChangeSet(id: string, input: unknown, reviewerId: string): ReviewRow {
  const rec = getChangeSet(id);
  const body = reviewRequestSchema.parse(input);
  if (body.expectedRevision !== rec.revision) {
    throw Object.assign(new Error("stale revision"), { status: 409, code: "error.conflict" });
  }
  if (rec.status !== "pending_review") {
    throw Object.assign(new Error("not pending review"), { status: 409, code: "error.conflict" });
  }
  if (rec.targetEnvironment === "production" && rec.createdBy === reviewerId) {
    throw Object.assign(new Error("editor cannot approve own production change"), { status: 403, code: "error.forbidden" });
  }
  const row: ReviewRow = {
    id: newId(),
    changeSetId: id,
    reviewerUserId: reviewerId,
    decision: body.decision,
    comment: body.comment || "",
    reviewedRevision: rec.revision,
    createdAt: nowIso(),
  };
  store.reviews.push(row);
  if (body.decision === "approve") {
    rec.approvedAt = nowIso();
    transition(rec, "approved", reviewerId);
  } else {
    rec.approvedAt = null;
    transition(rec, "rejected", reviewerId);
  }
  return row;
}
