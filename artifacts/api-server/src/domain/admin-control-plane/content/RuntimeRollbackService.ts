import { pauseCanary } from "./CanaryRolloutService";
import { rollbackAccessChangeSet } from "../access/AdminRollbackService";
import { appendAudit } from "../auditService";
import { store } from "../repositories/memoryStore";

export function rollbackPublication(publicationId: string, body: Record<string, unknown>, actorId: string) {
  const rollout = [...store.rollouts.values()].find(
    (r) => String(r.id) === publicationId || String(r.changeSetId) === publicationId,
  );
  if (rollout) {
    try {
      pauseCanary(String(rollout.id), actorId);
    } catch {
      /* already paused */
    }
  }
  const result = rollbackAccessChangeSet(String(body.changeSetId || publicationId), body, actorId);
  appendAudit({
    actorUserId: actorId,
    actorSessionId: null,
    action: "rollout.rollback",
    resourceType: "runtime.bundle",
    resourceId: publicationId,
    environment: "local",
    beforeVersion: null,
    afterVersion: publicationId,
    changeSetId: String(body.changeSetId || publicationId),
    requestId: null,
    safeMetadata: { reason: String(body.reason || "").slice(0, 200) },
  });
  return result;
}
