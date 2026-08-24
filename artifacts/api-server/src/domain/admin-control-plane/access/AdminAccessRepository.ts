import { readFileSync } from "node:fs";
import { repoPath } from "../../../lib/repoRoot";

export type AdminAccessRow = {
  resourceId: string;
  name: string;
  type: string;
  ownerDomain: string;
  sourceRegistry: string;
  sourceTable: string;
  currentVersion: number;
  editor: string;
  permission: string;
  pipeline: string;
  dependencies: Array<{ type: string; id: string; note?: string }>;
  consumers: Array<{ id: string; type?: string }>;
  previewPath: string;
  publicationPath: string;
  fallback: string | null;
  rollback: string;
  releaseRequirement: string;
  testStatus: string;
  previewExperienceIds: string[];
  runtimeChangeable: boolean;
  requiresFrontendRelease: boolean;
  requiresBackendRelease: boolean;
  requiresNativeRelease: boolean;
  status: string;
  schemaId: string;
};

let cache: { items: AdminAccessRow[]; byId: Map<string, AdminAccessRow> } | null = null;

function catalogPath(): string {
  return repoPath("config/admin-access/generated/complete-access-map.generated.json");
}

export function loadAdminAccessCatalog(): { items: AdminAccessRow[]; byId: Map<string, AdminAccessRow> } {
  if (cache) return cache;
  const raw = JSON.parse(readFileSync(catalogPath(), "utf8")) as { items: AdminAccessRow[] };
  const byId = new Map(raw.items.map((i) => [i.resourceId, i]));
  cache = { items: raw.items, byId };
  return cache;
}

export function resetAdminAccessCatalogCache(): void {
  cache = null;
}
