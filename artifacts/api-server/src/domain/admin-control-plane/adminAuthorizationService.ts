import type { AdminEnvironment, AdminPermission, AdminRole } from "@workspace/api-zod";
import { permissionsForRoles } from "./adminPermissionPolicy";
import { detectAdminEnvironment, isProductionRuntime } from "./adminIdentityService";
import { nowIso, store, type AdminUserRoleRow } from "./repositories/memoryStore";

export type AdminAuthzContext = {
  userId: string;
  roles: AdminRole[];
  permissions: Set<AdminPermission>;
  environment: AdminEnvironment | "local" | "test" | "preview" | "staging" | "production";
  grants: AdminUserRoleRow[];
};

function activeGrant(row: AdminUserRoleRow, env: string, at: number): boolean {
  if (row.revokedAt) return false;
  if (Date.parse(row.startsAt) > at) return false;
  if (row.expiresAt && Date.parse(row.expiresAt) <= at) return false;
  if (row.environmentScope !== "*" && row.environmentScope !== env) return false;
  return true;
}

export function listActiveGrants(userId: string, env = detectAdminEnvironment()): AdminUserRoleRow[] {
  const at = Date.now();
  return store.roles.filter((r) => r.userId === userId && activeGrant(r, env, at));
}

export function resolveAdminAuthz(input: {
  userId: string;
  profileRole?: string | null;
  jwtRole?: string | null;
}): AdminAuthzContext {
  const environment = detectAdminEnvironment();
  // ignoreClientRole — JWT/profile role is never authorization; only canonical grants.
  const grants = listActiveGrants(input.userId, environment);
  let roles = [...new Set(grants.map((g) => g.role))];

  // Bootstrap: legacy profile.role=admin maps to super_admin only outside production.
  // Production requires explicit admin_user_roles rows (deny by default).
  if (!roles.length && !isProductionRuntime() && (input.profileRole === "admin" || input.jwtRole === "admin")) {
    roles = ["super_admin"];
  }

  return {
    userId: input.userId,
    roles,
    permissions: permissionsForRoles(roles),
    environment,
    grants,
  };
}

export function assertPermission(ctx: AdminAuthzContext, permission: AdminPermission, resourceScope?: string): void {
  if (!ctx.permissions.has(permission)) {
    throw Object.assign(new Error("forbidden"), { status: 403, code: "error.forbidden", permission });
  }
  if (resourceScope) {
    const scoped = ctx.grants.filter((g) => g.resourceScope === "*" || g.resourceScope === "all" || g.resourceScope === resourceScope || !g.resourceScope);
    if (ctx.roles.includes("super_admin")) return;
    if (ctx.grants.length && !scoped.length && !ctx.roles.includes("admin_viewer")) {
      throw Object.assign(new Error("forbidden_scope"), { status: 403, code: "error.forbidden" });
    }
  }
}

export function ignoreClientRole(_body: unknown): void {
  /* Client role/isAdmin/permissions fields are never read. */
}
