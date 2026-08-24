import { assertNotProductionActivationFromLocal } from "./configPolicy";
import { activateAtomic, appendAudit, getVersion, updateStatus } from "./configRepository";
import { healthCheckVersion } from "./ConfigHealthService";
import { validateConfigVersion } from "./ConfigVersionService";

export function activateConfigVersion(id: string, actor: string, reason?: string, ifMatch?: string) {
  const rec = getVersion(id);
  if (!rec) throw new Error("version not found");
  assertNotProductionActivationFromLocal(rec.environment);
  if (ifMatch && ifMatch !== rec.checksum) throw new Error("optimistic concurrency mismatch");
  if (rec.status === "draft") validateConfigVersion(id);
  const current = getVersion(id)!;
  const health = healthCheckVersion(current);
  if (!health.ok) throw new Error("failed health check cannot activate");
  const published =
    current.immutable || current.status === "published" || current.status === "active" || current.status === "superseded"
      ? current
      : updateStatus(id, "published");
  const active = activateAtomic(published.environment, published);
  appendAudit({
    actor,
    action: "activate",
    versionId: active.id,
    environment: active.environment,
    reason,
    details: { checksum: active.checksum },
  });
  return active;
}
