import { createHash } from "node:crypto";
import { loadAdminAccessCatalog } from "../access/AdminAccessRepository";
import { newId, nowIso, store } from "../repositories/memoryStore";
import type { RuntimeResource } from "@workspace/admin-access";

export function compileRuntimeBundle(input: { snapshotId?: string; environment?: string; actorId: string }) {
  const catalog = loadAdminAccessCatalog();
  const items: RuntimeResource[] = catalog.items
    .filter((item) => item.status === "active" && item.runtimeChangeable)
    .filter((item) =>
      item.type.startsWith("gift.") ||
      item.type.startsWith("face-effect") ||
      item.type.startsWith("beauty-effect") ||
      item.type === "animation.pack" ||
      item.type === "session.snapshot" ||
      item.type.startsWith("ui.") ||
      item.type.startsWith("config."),
    )
    .slice(0, 400)
    .map((item) => ({
      resourceId: item.resourceId,
      resourceType: item.type,
      version: Number(item.currentVersion || 1),
      schemaVersion: 1,
      rendererId: item.dependencies?.find((d) => d.type === "effect.renderer")?.id || "renderer.gift.static.v1",
      rendererVersionRange: "*",
      dependencies: (item.dependencies || []).map((d) => ({ type: d.type, id: d.id })),
      variants: [],
      fallbackResourceId: item.fallback || "fallback.catalog.bundled",
      capabilityProfileIds: ["tier-0-static", "tier-1-low", "tier-2-medium", "tier-3-high"],
      performanceProfileId: item.dependencies?.find((d) => d.type === "performance.profile")?.id || "perf.tier-2-medium",
      platforms: ["web", "ios", "android"],
      localeSupport: ["en"],
      checksum: "",
      byteSize: 0,
      status: "published" as const,
    }));
  const payload = {
    schemaVersion: 1,
    brand: "UniLive’s",
    snapshotId: input.snapshotId || "snapshot.bundled.default",
    environment: input.environment || "local",
    compiledAt: nowIso(),
    items,
  };
  const checksum = createHash("sha256").update(JSON.stringify(payload.items.map((i) => i.resourceId))).digest("hex");
  const bundle = {
    id: newId(),
    version: store.runtimeBundles.size + 1,
    checksum,
    byteSize: JSON.stringify(payload).length,
    itemCount: items.length,
    status: "compiled",
    payload,
    createdBy: input.actorId,
    createdAt: nowIso(),
  };
  store.runtimeBundles.set(bundle.id, bundle);
  return bundle;
}

export function getRuntimeBundle(id: string) {
  const row = store.runtimeBundles.get(id);
  if (!row) throw Object.assign(new Error("not found"), { status: 404, code: "error.notFound" });
  return row;
}

export function listRuntimeBundles() {
  return [...store.runtimeBundles.values()].map((b) => ({
    id: b.id,
    version: b.version,
    checksum: b.checksum,
    itemCount: b.itemCount,
    status: b.status,
    createdAt: b.createdAt,
  }));
}
