import { createResourceDraftSchema, editPermissionForType, readPermissionForType, validateAdminAccessPatch } from "@workspace/admin-access";
import type { AdminPermission } from "@workspace/api-zod";
import { assertPermission, type AdminAuthzContext } from "../adminAuthorizationService";
import { addOrUpdateItem, listItems } from "../changeItemService";
import { createChangeSet, getChangeSet } from "../changeSetService";
import { detectAdminEnvironment } from "../adminIdentityService";
import { newId, nowIso } from "../repositories/memoryStore";
import { loadAdminAccessCatalog, type AdminAccessRow } from "./AdminAccessRepository";
import { assertEditableType } from "./AdminEditorPolicy";
import { auditAccess, historyFor } from "./AdminAccessAuditService";
import { consumersFor, dependenciesFor } from "./AdminDependencyService";

export type CatalogDraft = {
  id: string;
  resourceId: string;
  changeSetId: string;
  itemId: string;
  actorId: string;
  createdAt: string;
};

const drafts = new Map<string, CatalogDraft>();

export function resetAdminAccessDrafts(): void {
  drafts.clear();
}

export function listAdminResources(query: {
  q?: string;
  type?: string;
  domain?: string;
  experience?: string;
  status?: string;
  permission?: string;
  missingFallback?: boolean;
  releaseRequirement?: string;
}): AdminAccessRow[] {
  const catalog = loadAdminAccessCatalog();
  const q = (query.q || "").toLowerCase().trim();
  return catalog.items.filter((item) => {
    if (query.type && item.type !== query.type) return false;
    if (query.domain && item.ownerDomain !== query.domain) return false;
    if (query.status && item.status !== query.status) return false;
    if (query.permission && item.permission !== query.permission) return false;
    if (query.releaseRequirement && item.releaseRequirement !== query.releaseRequirement) return false;
    if (query.missingFallback && item.fallback) return false;
    if (query.experience && !(item.previewExperienceIds || []).includes(query.experience)) return false;
    if (!q) return true;
    return (
      item.resourceId.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q) ||
      item.ownerDomain.toLowerCase().includes(q) ||
      item.editor.toLowerCase().includes(q) ||
      item.pipeline.toLowerCase().includes(q)
    );
  });
}

export function getAdminResource(resourceId: string): AdminAccessRow {
  const rec = loadAdminAccessCatalog().byId.get(resourceId);
  if (!rec) throw Object.assign(new Error("not found"), { status: 404, code: "error.notFound" });
  return rec;
}

export function assertCanReadResource(ctx: AdminAuthzContext, rec: AdminAccessRow): void {
  assertPermission(ctx, readPermissionForType(rec.type) as AdminPermission);
}

export function assertCanEditResource(ctx: AdminAuthzContext, rec: AdminAccessRow): void {
  const perm = editPermissionForType(rec.type);
  if (!perm) throw Object.assign(new Error("read-only resource"), { status: 403, code: "error.forbidden" });
  assertPermission(ctx, perm as AdminPermission);
}

export function resourceDetail(resourceId: string) {
  const rec = getAdminResource(resourceId);
  return {
    ...rec,
    dependencies: dependenciesFor(resourceId),
    consumers: consumersFor(resourceId),
    history: historyFor(resourceId),
    impact: {
      changed: [{ id: rec.resourceId, type: rec.type, version: rec.currentVersion }],
      unchangedHint: "Sibling nodes, actions, bindings, wallet, gifts, PK, LiveKit, and identity remain unchanged unless listed.",
    },
  };
}

export function createResourceDraft(resourceId: string, input: unknown, actorId: string, ctx: AdminAuthzContext): CatalogDraft {
  const rec = getAdminResource(resourceId);
  assertCanEditResource(ctx, rec);
  assertEditableType(rec.type);
  const body = createResourceDraftSchema.parse(input || {});
  const patch = body.patch || { name: rec.name, fallbackId: rec.fallback || "fallback.catalog.bundled" };
  const issues = validateAdminAccessPatch(patch);
  if (issues.length) {
    throw Object.assign(new Error(issues[0]!.message), { status: 400, code: issues[0]!.code, issues });
  }
  const cs = createChangeSet(
    {
      title: body.title || `Draft ${rec.name}`,
      targetEnvironment: body.targetEnvironment || detectAdminEnvironment(),
      baseSnapshotId: rec.type === "session.snapshot" ? rec.resourceId : "snapshot.bundled.default",
      description: `Independent change for ${rec.resourceId}`,
    },
    actorId,
  );
  const item = addOrUpdateItem(
    cs.id,
    {
      resourceType: rec.type,
      resourceId: rec.resourceId,
      operation: body.operation || "update",
      patch,
    },
    actorId,
  );
  const draft: CatalogDraft = {
    id: newId(),
    resourceId,
    changeSetId: cs.id,
    itemId: item.id,
    actorId,
    createdAt: nowIso(),
  };
  drafts.set(draft.id, draft);
  auditAccess(actorId, "access.draft.create", resourceId, { changeSetId: cs.id, draftId: draft.id });
  return draft;
}

export function getDraft(draftId: string): CatalogDraft {
  const rec = drafts.get(draftId);
  if (!rec) throw Object.assign(new Error("not found"), { status: 404, code: "error.notFound" });
  return rec;
}

export function patchDraft(draftId: string, input: unknown, actorId: string, ctx: AdminAuthzContext) {
  const draft = getDraft(draftId);
  const rec = getAdminResource(draft.resourceId);
  assertCanEditResource(ctx, rec);
  const body = createResourceDraftSchema.parse(input || {});
  const patch = body.patch || {};
  const issues = validateAdminAccessPatch(patch);
  if (issues.length) {
    throw Object.assign(new Error(issues[0]!.message), { status: 400, code: issues[0]!.code, issues });
  }
  const cs = getChangeSet(draft.changeSetId);
  const item = addOrUpdateItem(
    draft.changeSetId,
    {
      resourceType: rec.type,
      resourceId: rec.resourceId,
      operation: body.operation || "update",
      patch,
      expectedRevision: cs.revision,
    },
    actorId,
  );
  draft.itemId = item.id;
  return { draft, changeSet: getChangeSet(draft.changeSetId), item, items: listItems(draft.changeSetId) };
}

export { drafts };
