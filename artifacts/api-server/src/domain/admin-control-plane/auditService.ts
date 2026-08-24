import { redactRecord } from "../../config/redaction";
import { newId, nowIso, store, type AuditRow } from "./repositories/memoryStore";

export function appendAudit(input: Omit<AuditRow, "id" | "createdAt" | "safeMetadata"> & { safeMetadata?: Record<string, unknown> }): AuditRow {
  const row: AuditRow = {
    id: newId(),
    createdAt: nowIso(),
    ...input,
    safeMetadata: redactRecord(input.safeMetadata || {}),
  };
  store.audit.push(row);
  return row;
}

export function listAudit(limit = 200): AuditRow[] {
  return store.audit.slice(-limit).reverse();
}
