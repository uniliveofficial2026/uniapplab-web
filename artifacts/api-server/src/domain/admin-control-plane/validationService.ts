import { REGISTERED_COMPONENT_IDS } from "../uiConfig/manifestValidate";
import { validateAdminPatch } from "./validators/forbiddenPayload";
import { listItems } from "./changeItemService";
import { getChangeSet, transition } from "./changeSetService";
import { secretReferenceAvailable } from "../../config/SecretResolver";
import type { ChangeItemRow } from "./repositories/memoryStore";

export type ValidationReport = {
  ok: boolean;
  status: "valid" | "invalid";
  issues: Array<{ itemId?: string; path: string; code: string; message: string }>;
  checks: Record<string, boolean>;
};

function validateItem(item: ChangeItemRow): ValidationReport["issues"] {
  const issues = validateAdminPatch(item.patchJson).map((i) => ({ ...i, itemId: item.id }));
  const componentId = item.patchJson.componentId;
  if (typeof componentId === "string" && !REGISTERED_COMPONENT_IDS.has(componentId) && !componentId.startsWith("primitive.")) {
    issues.push({ itemId: item.id, path: "$.componentId", code: "unknown_component", message: "unregistered component" });
  }
  if (item.resourceType === "runtime.secret_reference") {
    const ref = item.patchJson.secretReference;
    if (typeof ref === "string") {
      const avail = secretReferenceAvailable(ref);
      if (!avail.ok && avail.reason === "invalid") {
        issues.push({ itemId: item.id, path: "$.secretReference", code: "invalid_reference", message: avail.reason || "invalid" });
      }
    } else {
      issues.push({ itemId: item.id, path: "$.secretReference", code: "missing_reference", message: "secret reference required" });
    }
    if (item.patchJson.value != null || item.patchJson.secretValue != null) {
      issues.push({ itemId: item.id, path: "$.value", code: "secret_value_forbidden", message: "secret values are not accepted" });
    }
  }
  if (item.resourceType.startsWith("ui.") && !item.patchJson.fallbackId && item.operation !== "archive") {
    if (item.resourceType === "ui.node" || item.resourceType === "ui.experience") {
      issues.push({ itemId: item.id, path: "$.fallbackId", code: "missing_fallback", message: "fallback required" });
    }
  }
  if ((item.resourceType === "ui.node" || item.resourceType === "ui.translation") && !item.patchJson.translationKey && item.operation !== "archive" && item.resourceType === "ui.translation") {
    issues.push({ itemId: item.id, path: "$.translationKey", code: "missing_translation", message: "translation key required" });
  }
  return issues;
}

export function validateChangeSet(id: string, actorId: string): ValidationReport {
  const rec = getChangeSet(id);
  if (["cancelled", "published", "rolled_back", "pending_review", "approved", "publishing"].includes(rec.status)) {
    throw Object.assign(new Error("cannot validate"), { status: 409, code: "error.conflict" });
  }
  rec.status = "validating";
  const items = listItems(id);
  const issues = items.flatMap(validateItem);
  const checks = {
    schema: issues.every((i) => i.code !== "forbidden_key" && i.code !== "forbidden_code"),
    authority: issues.every((i) => i.code !== "authority_forbidden"),
    secrets: issues.every((i) => i.code !== "secret_value_forbidden"),
    components: issues.every((i) => i.code !== "unknown_component"),
    fallbacks: issues.every((i) => i.code !== "missing_fallback"),
    translations: issues.every((i) => i.code !== "missing_translation"),
    references: issues.every((i) => i.code !== "invalid_reference" && i.code !== "missing_reference"),
    rollbackTarget: Boolean(rec.baseSnapshotId),
  };
  const ok = issues.length === 0 && Object.values(checks).every(Boolean);
  for (const item of items) {
    const own = issues.filter((i) => i.itemId === item.id);
    item.validationStatus = own.length ? "invalid" : "valid";
    item.validationIssues = own.map(({ path, code, message }) => ({ path, code, message }));
  }
  if (ok) transition(rec, rec.status === "validating" ? "valid" : "valid", actorId);
  else {
    rec.status = "invalid";
    rec.updatedAt = new Date().toISOString();
  }
  return { ok, status: ok ? "valid" : "invalid", issues, checks };
}
