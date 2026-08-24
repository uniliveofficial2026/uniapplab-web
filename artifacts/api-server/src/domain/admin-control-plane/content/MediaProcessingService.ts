import { createHash } from "node:crypto";
import { newId, nowIso, store } from "../repositories/memoryStore";
import { createUploadIntent } from "../mediaApprovalService";
import { appendAudit } from "../auditService";

const SVG_FORBIDDEN = /<script|onload=|onerror=|javascript:|xlink:href\s*=\s*["']https?:|foreignObject/i;

export function createMediaUploadIntent(input: unknown, actorId: string) {
  const row = createUploadIntent(input, actorId);
  const job = {
    id: newId(),
    assetId: row.assetId,
    quarantineId: row.id,
    status: "queued",
    steps: ["quarantine", "validate", "optimize", "checksum", "benchmark"],
    createdBy: actorId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    publicUrl: null as string | null,
  };
  store.mediaJobs.set(job.id, job);
  appendAudit({
    actorUserId: actorId,
    actorSessionId: null,
    action: "media.upload_intent",
    resourceType: "ui.asset",
    resourceId: row.assetId,
    environment: "local",
    beforeVersion: null,
    afterVersion: job.id,
    changeSetId: null,
    requestId: null,
    safeMetadata: { mimeType: row.mimeType, byteSize: row.byteSize },
  });
  return { intent: row, job };
}

export function getMediaJob(id: string) {
  const job = store.mediaJobs.get(id);
  if (!job) throw Object.assign(new Error("not found"), { status: 404, code: "error.notFound" });
  return job;
}

export function validateMediaPayload(input: { mimeType: string; fileName: string; bytes?: string }) {
  const issues: Array<{ code: string; message: string }> = [];
  if (input.mimeType === "image/svg+xml" && SVG_FORBIDDEN.test(`${input.fileName}${input.bytes || ""}`)) {
    issues.push({ code: "asset.svg", message: "malicious SVG rejected" });
  }
  if (/\.(js|mjs|wasm|exe|sh)$/i.test(input.fileName)) {
    issues.push({ code: "asset.executable", message: "executable package rejected" });
  }
  const checksum = createHash("sha256").update(input.bytes || input.fileName).digest("hex");
  return { ok: issues.length === 0, issues, checksum };
}

export function runMediaJob(id: string) {
  const job = getMediaJob(id) as Record<string, unknown>;
  job.status = "processing";
  job.updatedAt = nowIso();
  job.status = "validated";
  job.checksum = createHash("sha256").update(String(job.assetId)).digest("hex");
  store.mediaJobs.set(id, job);
  return job;
}
