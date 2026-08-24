import { listReviews } from "./reviewService";
import { getChangeSet } from "./changeSetService";

export function currentApproval(changeSetId: string) {
  const rec = getChangeSet(changeSetId);
  const reviews = listReviews(changeSetId).filter((r) => r.decision === "approve");
  const latest = reviews.at(-1) || null;
  return {
    approved: rec.status === "approved" || rec.status === "publishing" || rec.status === "published",
    approvalMatchesRevision: Boolean(latest && latest.reviewedRevision === rec.revision),
    reviewerUserId: latest?.reviewerUserId || null,
    reviewedRevision: latest?.reviewedRevision || null,
  };
}
