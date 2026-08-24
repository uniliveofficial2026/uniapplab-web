import { canOverrideGate, MAIN_THREAD_LONG_TASK_MS, WEB_P75 } from "@workspace/admin-access";
import { newId, nowIso, store } from "../repositories/memoryStore";
import { appendAudit } from "../auditService";
import { sloPublicationBlocked } from "../../../lib/performance/sloMetrics";

export function benchmarkChangeSet(changeSetId: string, actorId: string, metrics?: Record<string, unknown>) {
  const lcp = Number(metrics?.lcpMs ?? 1800);
  const inp = Number(metrics?.inpMs ?? 90);
  const cls = Number(metrics?.cls ?? 0.04);
  const longTask = Number(metrics?.mainThreadLongTaskMs ?? 18);
  const failed: string[] = [];
  if (lcp > WEB_P75.lcpMs) failed.push("lcp");
  if (inp > WEB_P75.inpMs) failed.push("inp");
  if (cls > WEB_P75.cls) failed.push("cls");
  if (longTask > MAIN_THREAD_LONG_TASK_MS) failed.push("mainThreadLongTask");
  if (metrics?.cleanupOk === false) failed.push("cleanupFails");
  if (metrics?.fallbackOk === false) failed.push("missingFallback");
  failed.push(...sloPublicationBlocked((metrics || {}) as Record<string, unknown>));
  const report = {
    id: newId(),
    changeSetId,
    createdAt: nowIso(),
    metrics: { lcpMs: lcp, inpMs: inp, cls, mainThreadLongTaskMs: longTask, ...metrics },
    failedGates: failed,
    status: failed.length ? "blocked" : "passed",
  };
  store.performanceReports.set(report.id, report);
  appendAudit({
    actorUserId: actorId,
    actorSessionId: null,
    action: "performance.benchmark",
    resourceType: "performance.profile",
    resourceId: changeSetId,
    environment: "local",
    beforeVersion: null,
    afterVersion: report.id,
    changeSetId,
    requestId: null,
    safeMetadata: { status: report.status, failed },
  });
  return report;
}

export function overridePerformanceGate(reportId: string, gate: string, reason: string, expiresAt: string, actorId: string) {
  if (!canOverrideGate(gate)) {
    throw Object.assign(new Error("gate cannot be overridden"), { status: 403, code: "performance.override_forbidden" });
  }
  if (!reason || reason.length < 8) {
    throw Object.assign(new Error("explicit reason required"), { status: 400, code: "performance.override_reason" });
  }
  const report = store.performanceReports.get(reportId);
  if (!report) throw Object.assign(new Error("not found"), { status: 404, code: "error.notFound" });
  report.override = { gate, reason, expiresAt, actorId, at: nowIso() };
  report.status = "overridden";
  store.performanceReports.set(reportId, report);
  appendAudit({
    actorUserId: actorId,
    actorSessionId: null,
    action: "performance.override",
    resourceType: "performance.profile",
    resourceId: reportId,
    environment: "local",
    beforeVersion: null,
    afterVersion: reportId,
    changeSetId: null,
    requestId: null,
    safeMetadata: { gate, expiresAt },
  });
  return report;
}

export function getPerformanceForResource(resourceId: string) {
  return [...store.performanceReports.values()].filter((r) => String(r.resourceId || r.changeSetId) === resourceId);
}
