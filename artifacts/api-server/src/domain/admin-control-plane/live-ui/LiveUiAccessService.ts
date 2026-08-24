import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { appendAudit } from "../auditService";
import { createAssignment, listAssignments } from "../assignmentService";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../../../..");

function loadRegistry(): Record<string, unknown> {
  const path = join(ROOT, "config/ui-catalog/experiences/live/_registry/live-experience-registry.json");
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

export function getLiveUiRegistry() {
  return loadRegistry();
}

export function listLiveExperiencesAdmin() {
  const registry = loadRegistry();
  return (registry.experiences as Array<Record<string, unknown>>) || [];
}

export function listLiveNodesAdmin() {
  const registry = loadRegistry();
  return (registry.nodes as Array<Record<string, unknown>>) || [];
}

export function listLiveActionsAdmin() {
  const registry = loadRegistry();
  return (registry.actions as Array<Record<string, unknown>>) || [];
}

export function listLiveBindingsAdmin() {
  const registry = loadRegistry();
  return (registry.bindings as Array<Record<string, unknown>>) || [];
}

export function listLiveLayoutsAdmin() {
  const registry = loadRegistry();
  return (registry.layouts as Array<Record<string, unknown>>) || [];
}

export function liveCompatibilityMatrix() {
  return listLiveExperiencesAdmin().map((e) => ({
    experienceId: e.experienceId,
    canonicalRoomTypes: e.canonicalRoomTypes,
    uiRoomModes: e.uiRoomModes,
    mediaMode: e.mediaMode,
    backendStatus: e.backendStatus,
    backendNote: e.backendNote || null,
    pkSupport: e.pkSupport,
    seats: e.seats,
  }));
}

const FORBIDDEN = /<\s*script|javascript:|new\s+Function|eval\s*\(|service[_-]?role|livekit.*secret|BEGIN (RSA |OPENSSH )?PRIVATE/i;

export function validateLiveUiPatch(patch: unknown): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const text = JSON.stringify(patch || {});
  if (FORBIDDEN.test(text)) issues.push("executable_or_secret");
  if (/wallet\.balance|gift\.debit|live_room_seats|live_pk_sessions/i.test(text) && /write|mutate|update/i.test(text)) {
    issues.push("canonical_mutation_forbidden");
  }
  const rec = patch && typeof patch === "object" ? (patch as Record<string, unknown>) : {};
  if (rec.actionId && rec.nodeId) {
    const leave = String(rec.nodeId).includes("leave") || String(rec.actionId) === "live.room.leave";
    if (leave && String(rec.actionId).startsWith("live.gift")) issues.push("leave_to_gift_forbidden");
    const action = String(rec.actionId);
    const nodeId = String(rec.nodeId);
    if (nodeId.includes("leave") && (action === "live.room.end" || action === "live.pk.end")) {
      issues.push("leave_action_remap_forbidden");
    }
    if ((nodeId.includes("end-live") || nodeId.includes("end-room")) && (action === "live.room.leave" || action === "live.pk.end")) {
      issues.push("end_live_action_remap_forbidden");
    }
    if (nodeId.includes("pk") && nodeId.includes("end") && action === "live.room.end") {
      issues.push("pk_end_remap_forbidden");
    }
  }
  if (rec.removeConfirmation === true || rec.weakenConfirmation === true) {
    issues.push("confirmation_weaken_forbidden");
  }
  if (rec.bindingId === "binding.live.pk-score" && String(rec.target || "").includes("wallet")) {
    issues.push("pk_score_wallet_forbidden");
  }
  return { ok: issues.length === 0, issues };
}

export function assignLiveExperienceSnapshot(input: unknown, actorId: string) {
  const row = createAssignment(input, actorId);
  appendAudit({
    actorUserId: actorId,
    actorSessionId: null,
    action: "live.experience.assign",
    resourceType: "session.assignment",
    resourceId: row.id,
    environment: "local",
    beforeVersion: null,
    afterVersion: row.snapshotId,
    changeSetId: null,
    requestId: null,
    safeMetadata: { sessionType: row.sessionType },
  });
  return row;
}

export function listLiveAssignments() {
  return listAssignments();
}
