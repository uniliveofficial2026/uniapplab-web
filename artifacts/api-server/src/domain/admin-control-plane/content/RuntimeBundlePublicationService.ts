import { compileRuntimeBundle, getRuntimeBundle } from "./RuntimeBundleCompiler";
import { appendAudit } from "../auditService";
import { nowIso } from "../repositories/memoryStore";

export function publishRuntimeBundle(bundleId: string, actorId: string) {
  const bundle = getRuntimeBundle(bundleId) as Record<string, unknown>;
  bundle.status = "published";
  bundle.publishedAt = nowIso();
  appendAudit({
    actorUserId: actorId,
    actorSessionId: null,
    action: "runtime.bundle.publish",
    resourceType: "runtime.bundle",
    resourceId: String(bundle.id),
    environment: "local",
    beforeVersion: null,
    afterVersion: String(bundle.version),
    changeSetId: null,
    requestId: null,
    safeMetadata: { checksum: bundle.checksum, itemCount: bundle.itemCount },
  });
  return bundle;
}

export function compileAndPublish(actorId: string, snapshotId?: string) {
  const compiled = compileRuntimeBundle({ actorId, snapshotId });
  return publishRuntimeBundle(compiled.id as string, actorId);
}
