import { listAudit } from "./configRepository";
import { redactRecord } from "./redaction";

export function listConfigAudit() {
  return listAudit().map((row) => ({
    ...row,
    details: row.details ? redactRecord(row.details) : undefined,
  }));
}
