import type { AdminEnvironment, AdminRole } from "@workspace/api-zod";
import { grantRoleRequestSchema } from "@workspace/api-zod";
import { ADMIN_ROLES } from "./adminPermissionPolicy";
import { appendAudit } from "./auditService";
import { newId, nowIso, store, type AdminUserRoleRow } from "./repositories/memoryStore";

export function listUserRoles(userId?: string): AdminUserRoleRow[] {
  return userId ? store.roles.filter((r) => r.userId === userId) : [...store.roles];
}

export function grantRole(input: unknown, actorId: string, actorCanGrant: boolean): AdminUserRoleRow {
  if (!actorCanGrant) throw Object.assign(new Error("forbidden"), { status: 403, code: "error.forbidden" });
  const body = grantRoleRequestSchema.parse(input);
  if (body.userId === actorId && body.role === "security_admin") {
    throw Object.assign(new Error("cannot self-grant security_admin"), { status: 403, code: "error.forbidden" });
  }
  if (!ADMIN_ROLES.includes(body.role)) {
    throw Object.assign(new Error("unknown role"), { status: 400, code: "error.conflict" });
  }
  const row: AdminUserRoleRow = {
    id: newId(),
    userId: body.userId,
    role: body.role,
    environmentScope: body.environmentScope as AdminEnvironment,
    resourceScope: body.resourceScope || "*",
    grantedBy: actorId,
    reason: body.reason,
    startsAt: nowIso(),
    expiresAt: body.expiresAt || null,
    revokedAt: null,
    createdAt: nowIso(),
  };
  store.roles.push(row);
  appendAudit({
    actorUserId: actorId,
    actorSessionId: null,
    action: "access.role.grant",
    resourceType: "admin.user_role",
    resourceId: row.id,
    environment: row.environmentScope,
    beforeVersion: null,
    afterVersion: row.role,
    changeSetId: null,
    requestId: null,
    safeMetadata: { userId: row.userId, role: row.role, reason: row.reason },
  });
  return row;
}

export function revokeRole(grantId: string, actorId: string): AdminUserRoleRow {
  const row = store.roles.find((r) => r.id === grantId);
  if (!row) throw Object.assign(new Error("not found"), { status: 404, code: "error.notFound" });
  row.revokedAt = nowIso();
  appendAudit({
    actorUserId: actorId,
    actorSessionId: null,
    action: "access.role.revoke",
    resourceType: "admin.user_role",
    resourceId: row.id,
    environment: row.environmentScope === "*" ? "local" : row.environmentScope,
    beforeVersion: row.role,
    afterVersion: null,
    changeSetId: null,
    requestId: null,
    safeMetadata: { userId: row.userId, role: row.role },
  });
  return row;
}
