import { dedupe, memoryGet, persistentGet, persistentSet, type CachedBundle } from "./runtimeBundleCache";

export type RuntimeBundleEnvelope = {
  snapshotId: string;
  checksum: string;
  version: number;
  schemaVersion: number;
  items: Array<{ resourceId: string; resourceType: string; version: number; checksum?: string; status?: string }>;
};

function bundledFallback(): CachedBundle {
  return {
    snapshotId: "snapshot.bundled.default",
    checksum: "bundled",
    version: 1,
    activatedAt: 0,
    payload: { schemaVersion: 1, items: [] },
  };
}

export async function fetchCompatibleBundle(signal?: AbortSignal): Promise<CachedBundle> {
  const lkg = memoryGet("lkg") || persistentGet() || bundledFallback();
  return dedupe("runtime-bundle", async () => {
    try {
      const res = await fetch("/api/ui-config/bootstrap", { signal, headers: { Accept: "application/json" } });
      if (!res.ok) return lkg;
      const json = (await res.json()) as Record<string, unknown>;
      const checksum = String(json.checksum || json.etag || json.snapshotId || "unknown");
      if (json.status && json.status !== "published") return lkg;
      const bundle: CachedBundle = {
        snapshotId: String(json.snapshotId || lkg.snapshotId),
        checksum,
        version: Number(json.version || 1),
        activatedAt: Date.now(),
        payload: json,
      };
      persistentSet(bundle);
      return bundle;
    } catch {
      return lkg;
    }
  });
}

export function lastKnownGood(): CachedBundle {
  return persistentGet() || bundledFallback();
}
