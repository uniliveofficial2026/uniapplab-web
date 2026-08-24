import { detectCycles } from "@workspace/admin-access";
import { loadAdminAccessCatalog } from "./AdminAccessRepository";

export function dependenciesFor(resourceId: string) {
  const rec = loadAdminAccessCatalog().byId.get(resourceId);
  if (!rec) throw Object.assign(new Error("not found"), { status: 404, code: "error.notFound" });
  const catalog = loadAdminAccessCatalog();
  const resolved = rec.dependencies.filter((d) => catalog.byId.has(d.id) || String(d.id).includes("://"));
  const missing = rec.dependencies.filter((d) => d.id && !catalog.byId.has(d.id) && !String(d.id).includes("://"));
  const cycles = detectCycles(
    catalog.items.flatMap((i) => (i.dependencies || []).map((d) => ({ from: i.resourceId, to: d.id, type: d.type }))),
  );
  return {
    resourceId,
    dependencies: resolved,
    missing,
    cyclesInvolving: cycles.filter((c) => c.includes(resourceId)),
  };
}

export function consumersFor(resourceId: string) {
  const rec = loadAdminAccessCatalog().byId.get(resourceId);
  if (!rec) throw Object.assign(new Error("not found"), { status: 404, code: "error.notFound" });
  return { resourceId, consumers: rec.consumers, previewExperienceIds: rec.previewExperienceIds };
}
