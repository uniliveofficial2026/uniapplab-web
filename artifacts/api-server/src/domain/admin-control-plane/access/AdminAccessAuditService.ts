import { appendAudit, listAudit } from "../auditService";

export function auditAccess(actorId: string, action: string, resourceId: string, extra: Record<string, unknown> = {}) {
  return appendAudit({
    actorUserId: actorId,
    actorSessionId: null,
    action,
    resourceType: "admin.access.resource",
    resourceId,
    environment: extra.environment ? String(extra.environment) : "local",
    beforeVersion: extra.before ? String(extra.before) : null,
    afterVersion: extra.after ? String(extra.after) : null,
    changeSetId: extra.changeSetId ? String(extra.changeSetId) : null,
    requestId: extra.requestId ? String(extra.requestId) : null,
    safeMetadata: extra,
  });
}

export function historyFor(resourceId: string) {
  return listAudit(500).filter((a) => a.resourceId === resourceId || a.safeMetadata?.resourceId === resourceId);
}
