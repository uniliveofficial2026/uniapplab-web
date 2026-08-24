import { createChangeSet, getChangeSet } from "../changeSetService";
import { addOrUpdateItem, listItems } from "../changeItemService";
import { validateAdminAccessPatch } from "@workspace/admin-access";
import { detectAdminEnvironment } from "../adminIdentityService";
import { newId, nowIso, store } from "../repositories/memoryStore";
import { appendAudit } from "../auditService";

const FORBIDDEN_CODE = /eval\s*\(|new\s+Function|<\s*script|javascript:|import\s*\(/i;
const FORBIDDEN_SHADER = /gl_FragColor|void\s+main\s*\(/i;
const FORBIDDEN_SQL = /\b(select|insert|update|delete|drop|alter)\b.+\b(from|into|table)\b/i;

export type ContentDraft = {
  id: string;
  kind: string;
  resourceType: string;
  resourceId: string;
  changeSetId: string;
  revision: number;
  status: "draft" | "validated" | "invalid";
  patch: Record<string, unknown>;
  issues: Array<{ path: string; code: string; message: string }>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

function asDraft(row: Record<string, unknown>): ContentDraft {
  return row as unknown as ContentDraft;
}

export function getContentDraft(id: string): ContentDraft {
  const row = store.contentDrafts.get(id);
  if (!row) throw Object.assign(new Error("not found"), { status: 404, code: "error.notFound" });
  return asDraft(row);
}

export function createContentDraft(input: {
  kind: string;
  resourceType: string;
  resourceId: string;
  patch: Record<string, unknown>;
  actorId: string;
  title?: string;
}): ContentDraft {
  const issues = collectIssues(input.resourceType, input.patch);
  const cs = createChangeSet(
    {
      title: input.title || `${input.kind} ${input.resourceId}`,
      targetEnvironment: detectAdminEnvironment() === "production" ? "preview" : detectAdminEnvironment(),
      baseSnapshotId: "snapshot.bundled.default",
    },
    input.actorId,
  );
  addOrUpdateItem(cs.id, {
    resourceType: input.resourceType as never,
    resourceId: input.resourceId,
    operation: "update",
    patch: input.patch,
  }, input.actorId);
  const draft: ContentDraft = {
    id: newId(),
    kind: input.kind,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    changeSetId: cs.id,
    revision: 1,
    status: issues.length ? "invalid" : "draft",
    patch: input.patch,
    issues,
    createdBy: input.actorId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  store.contentDrafts.set(draft.id, draft as unknown as Record<string, unknown>);
  appendAudit({
    actorUserId: input.actorId,
    actorSessionId: null,
    action: `${input.kind}.draft.create`,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    environment: cs.targetEnvironment,
    beforeVersion: null,
    afterVersion: draft.id,
    changeSetId: cs.id,
    requestId: null,
    safeMetadata: { kind: input.kind },
  });
  return draft;
}

export function patchContentDraft(id: string, patch: Record<string, unknown>, expectedRevision: number, actorId: string): ContentDraft {
  const draft = getContentDraft(id);
  if (draft.revision !== expectedRevision) {
    throw Object.assign(new Error("revision conflict"), { status: 409, code: "error.conflict" });
  }
  const nextPatch = { ...draft.patch, ...patch };
  const issues = collectIssues(draft.resourceType, nextPatch);
  draft.patch = nextPatch;
  draft.issues = issues;
  draft.status = issues.length ? "invalid" : "draft";
  draft.revision += 1;
  draft.updatedAt = nowIso();
  addOrUpdateItem(draft.changeSetId, {
    resourceType: draft.resourceType as never,
    resourceId: draft.resourceId,
    operation: "update",
    patch: nextPatch,
    expectedRevision: getChangeSet(draft.changeSetId).revision,
  }, actorId);
  store.contentDrafts.set(id, draft as unknown as Record<string, unknown>);
  return draft;
}

export function validateContentDraft(id: string): ContentDraft {
  const draft = getContentDraft(id);
  draft.issues = collectIssues(draft.resourceType, draft.patch);
  draft.status = draft.issues.length ? "invalid" : "validated";
  draft.updatedAt = nowIso();
  store.contentDrafts.set(id, draft as unknown as Record<string, unknown>);
  return draft;
}

export function listContentDrafts(kind?: string): ContentDraft[] {
  return [...store.contentDrafts.values()]
    .map(asDraft)
    .filter((d) => !kind || d.kind === kind);
}

function collectIssues(resourceType: string, patch: Record<string, unknown>): Array<{ path: string; code: string; message: string }> {
  const issues = validateAdminAccessPatch(patch);
  if (resourceType === "gift.definition") {
    for (const key of ["price", "unitPrice", "coinPrice", "gift.price"]) {
      if (key in patch) issues.push({ path: `$.${key}`, code: "authority_forbidden", message: "visual gift draft cannot set price" });
    }
  }
  if (resourceType === "gift.pricing") {
    const coins = patch.coinPrice ?? patch.price;
    if (coins == null || !Number.isInteger(Number(coins)) || Number(coins) <= 0) {
      issues.push({ path: "$.coinPrice", code: "gift.pricing.integer", message: "integer coin units required" });
    }
    if (!patch.effectiveAt) issues.push({ path: "$.effectiveAt", code: "gift.pricing.schedule", message: "scheduled effective time required" });
  }
  if (resourceType === "face-effect.definition" || resourceType === "animation.pack") {
    const blob = JSON.stringify(patch);
    if (FORBIDDEN_CODE.test(blob)) issues.push({ path: "$", code: "forbidden_code", message: "executable payload rejected" });
    if (FORBIDDEN_SHADER.test(blob)) issues.push({ path: "$", code: "forbidden_shader", message: "arbitrary shader rejected" });
    if (FORBIDDEN_SQL.test(blob)) issues.push({ path: "$", code: "forbidden_sql", message: "SQL rejected" });
    if (patch.endpoint || patch.networkEndpoint) issues.push({ path: "$.endpoint", code: "unregistered_url", message: "unregistered endpoint rejected" });
  }
  if (!patch.rendererId && (resourceType === "gift.definition" || resourceType === "face-effect.definition" || resourceType === "animation.pack")) {
    issues.push({ path: "$.rendererId", code: "renderer.required", message: "registered rendererId required" });
  }
  if (!patch.performanceProfileId && resourceType !== "gift.pricing") {
    /* pricing is financial, not a visual publication */
  } else if (resourceType !== "gift.pricing" && !patch.performanceProfileId && (resourceType === "animation.pack" || resourceType === "face-effect.definition")) {
    issues.push({ path: "$.performanceProfileId", code: "performance.required", message: "performance profile required" });
  }
  void listItems;
  return issues;
}
