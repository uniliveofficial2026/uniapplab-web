import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { repoPath } from "../../lib/repoRoot";
import { listAdminResources, getAdminResource } from "./access/AdminAccessService";
import type { AdminAccessRow } from "./access/AdminAccessRepository";

const UI_CLONE_TYPES = new Set([
  "ui.experience",
  "ui.component",
  "ui.element",
  "ui.layout",
  "ui.node",
  "ui.mockup",
  "ui.design",
  "ui.action",
  "ui.data-binding",
]);

function catalogRoot(): string {
  return repoPath("config/ui-catalog");
}

function readJson<T>(absPath: string, fallback: T): T {
  try {
    if (!existsSync(absPath)) return fallback;
    return JSON.parse(readFileSync(absPath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function experienceFolderFromKey(key: string): string | null {
  const rel = key.replace(/^experience\./, "").replace(/\./g, "/");
  const dir = join(catalogRoot(), "experiences", rel);
  return existsSync(dir) ? dir : null;
}

function inferExperienceKey(row: AdminAccessRow): string | null {
  if (row.type === "ui.experience") return row.resourceId.replace(/^experience\./, "");
  const fromPreview = row.previewExperienceIds?.[0]?.replace(/^experience\./, "");
  if (fromPreview) return fromPreview;
  const parts = row.resourceId.split(".");
  if (parts.length >= 3 && (parts[0] === "node" || parts[0] === "layout" || parts[0] === "element" || parts[0] === "component")) {
    return `${parts[1]}.${parts[2]}`;
  }
  if (row.ownerDomain && row.ownerDomain !== "global" && row.ownerDomain !== "platform") {
    const nameParts = row.name.split(".")[0];
    if (nameParts) return `${row.ownerDomain}.${nameParts}`;
  }
  return null;
}

function loadExperienceBundle(experienceKey: string | null) {
  if (!experienceKey) return null;
  const segments = experienceKey.includes("/") ? experienceKey.split("/") : experienceKey.split(".");
  const folder = join(catalogRoot(), "experiences", ...segments);
  if (!existsSync(folder)) return null;
  return {
    experience: readJson<Record<string, unknown>>(join(folder, "experience.json"), {}),
    layout: readJson<Record<string, unknown>>(join(folder, "layout.json"), {}),
    nodes: readJson<{ items?: Array<Record<string, unknown>> }>(join(folder, "nodes.json"), { items: [] }).items || [],
    components: readJson<{ items?: Array<Record<string, unknown>> }>(join(folder, "components.json"), { items: [] }).items || [],
    elements: readJson<{ items?: Array<Record<string, unknown>> }>(join(folder, "elements.json"), { items: [] }).items || [],
    mockup: readJson<Record<string, unknown>>(join(folder, "mockup.json"), {}),
    design: readJson<Record<string, unknown>>(join(folder, "design.json"), {}),
  };
}

function enrichRow(row: AdminAccessRow) {
  const experienceKey = inferExperienceKey(row);
  const bundle = loadExperienceBundle(experienceKey);
  const nodeMatch =
    row.type === "ui.node" && bundle
      ? bundle.nodes.find((n) => String(n.nodeId || n.id) === row.resourceId)
      : null;
  const componentId =
    (nodeMatch?.componentId as string | undefined) ||
    (row.type === "ui.component" ? row.name : undefined) ||
    undefined;
  return {
    resourceId: row.resourceId,
    name: row.name,
    type: row.type,
    domain: row.ownerDomain,
    status: row.status,
    editor: row.editor,
    permission: row.permission,
    componentId: componentId || null,
    experienceKey,
    previewExperienceIds: row.previewExperienceIds,
    fallback: row.fallback,
    testStatus: row.testStatus,
    mockupSource: bundle?.mockup && typeof bundle.mockup.source === "string" ? bundle.mockup.source : null,
    routeKey: bundle?.experience && typeof bundle.experience.routeKey === "string" ? bundle.experience.routeKey : null,
    sourcePath:
      bundle?.experience && typeof bundle.experience.sourcePath === "string"
        ? bundle.experience.sourcePath
        : null,
    nodeCount: bundle?.nodes.length || 0,
    elementCount: bundle?.elements.length || 0,
    layoutPrimitive:
      bundle?.layout && typeof bundle.layout.primitive === "string" ? bundle.layout.primitive : null,
    layoutSlots:
      bundle?.layout && Array.isArray(bundle.layout.slots)
        ? (bundle.layout.slots as string[])
        : [],
  };
}

export function browseUiCloneCatalog(query: {
  q?: string;
  type?: string;
  domain?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = Math.min(Math.max(query.limit ?? 60, 1), 200);
  const offset = Math.max(query.offset ?? 0, 0);
  const typeFilter = query.type?.trim();
  const items = listAdminResources({
    q: query.q,
    type: typeFilter,
    domain: query.domain,
  }).filter((row) => (typeFilter ? true : UI_CLONE_TYPES.has(row.type)));

  return {
    total: items.length,
    offset,
    limit,
    items: items.slice(offset, offset + limit).map(enrichRow),
  };
}

export function getUiCloneDetail(resourceId: string) {
  const row = getAdminResource(resourceId);
  if (!UI_CLONE_TYPES.has(row.type)) {
    throw Object.assign(new Error("not a UI clone resource"), { status: 400, code: "ui.clone.invalidType" });
  }
  const experienceKey = inferExperienceKey(row);
  const bundle = loadExperienceBundle(experienceKey);
  const enriched = enrichRow(row);
  const nodeId = row.resourceId.startsWith("node.") ? row.resourceId : null;
  const node =
    nodeId && bundle
      ? bundle.nodes.find((n) => String(n.nodeId || n.id) === nodeId)
      : null;
  const relatedNodes =
    bundle?.nodes.filter((n) => {
      if (row.type === "ui.experience") return true;
      if (row.type === "ui.layout") return true;
      if (row.type === "ui.component") return String(n.componentId || "").includes(row.name.split(".")[0]);
      if (row.type === "ui.element") return String(n.elementId || "").includes(row.resourceId.replace("element.", ""));
      if (node) return String(n.parentNodeId || "") === nodeId || String(n.nodeId || n.id) === nodeId;
      return false;
    }).slice(0, 120) || [];

  return {
    ...enriched,
    resource: row,
    experience: bundle?.experience || null,
    layout: bundle?.layout || null,
    mockup: bundle?.mockup || null,
    design: bundle?.design || null,
    node: node || null,
    nodes: relatedNodes,
    components: bundle?.components?.slice(0, 80) || [],
    elements: bundle?.elements?.slice(0, 80) || [],
    dependencies: row.dependencies,
    consumers: row.consumers,
  };
}

export function listUiCloneDomains() {
  const counts = new Map<string, number>();
  for (const row of listAdminResources({})) {
    if (!UI_CLONE_TYPES.has(row.type)) continue;
    counts.set(row.ownerDomain, (counts.get(row.ownerDomain) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);
}

export function listUiCloneTypes() {
  const counts = new Map<string, number>();
  for (const row of listAdminResources({})) {
    if (!UI_CLONE_TYPES.has(row.type)) continue;
    counts.set(row.type, (counts.get(row.type) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}
