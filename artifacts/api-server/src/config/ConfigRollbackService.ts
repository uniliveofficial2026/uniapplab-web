import { appendAudit, getVersion, listVersions } from "./configRepository";
import { activateConfigVersion } from "./ConfigActivationService";

export function rollbackConfigVersion(id: string, actor: string, reason?: string) {
  const rec = getVersion(id);
  if (!rec) throw new Error("version not found");
  const prior = listVersions(rec.environment).find((v) => v.id !== id && (v.status === "published" || v.status === "superseded" || v.status === "rolled_back" || v.immutable));
  if (!prior) throw new Error("no prior published version");
  const active = activateConfigVersion(prior.id, actor, reason || `rollback from ${rec.version}`);
  appendAudit({
    actor,
    action: "rollback",
    versionId: active.id,
    environment: active.environment,
    reason,
    details: { from: rec.id, to: prior.id },
  });
  return active;
}
