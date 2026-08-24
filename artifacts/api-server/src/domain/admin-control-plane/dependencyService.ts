import { listItems } from "./changeItemService";
import { getChangeSet } from "./changeSetService";

export function dependencyImpact(changeSetId: string) {
  const rec = getChangeSet(changeSetId);
  const items = listItems(changeSetId);
  const changed = items.map((i) => ({ type: i.resourceType, id: i.resourceId, operation: i.operation }));
  const experiences = [...new Set(items.filter((i) => i.resourceType.startsWith("ui.")).map((i) => String(i.patchJson.experienceKey || i.resourceId)))];
  return {
    changeSetId,
    revision: rec.revision,
    baseSnapshotId: rec.baseSnapshotId,
    baseConfigVersionId: rec.baseConfigVersionId,
    changed,
    unchangedHint: "All other catalog resources remain at base snapshot",
    impactedExperiences: experiences,
    rollbackTarget: rec.baseSnapshotId,
    securityImpact: items.some((i) => i.resourceType.includes("secret") || i.resourceType.includes("config"))
      ? "configuration/secret-reference change"
      : "presentation only",
  };
}
