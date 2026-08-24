import type { NextFunction, Request, Response } from "express";
import type { AdminPermission } from "@workspace/api-zod";
import { apiError } from "../lib/apiError";
import {
  detectAdminEnvironment,
  isProductionRuntime,
  resolveAdminActorId,
} from "../domain/admin-control-plane/adminIdentityService";
import { assertPermission, resolveAdminAuthz } from "../domain/admin-control-plane/adminAuthorizationService";
import { STEP_UP_PERMISSIONS } from "../domain/admin-control-plane/adminPermissionPolicy";

function platformAdminUsernames(): Set<string> {
  return new Set(
    String(process.env.PLATFORM_ADMIN_USERNAMES ?? "uniliveofficial2026,oowai20")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function platformAdminEmails(): Set<string> {
  return new Set(
    String(process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function localPlatformAdminProfileRole(req: Request): string | null {
  if (isProductionRuntime()) return req.profile?.role ?? null;
  if (req.profile?.role === "admin") return "admin";
  const username = req.profile?.username?.trim().toLowerCase();
  if (username && platformAdminUsernames().has(username)) return "admin";
  const email = req.authUser?.email?.trim().toLowerCase();
  if (email && platformAdminEmails().has(email)) return "admin";
  return req.profile?.role ?? null;
}

declare global {
  namespace Express {
    interface Request {
      adminAuthz?: ReturnType<typeof resolveAdminAuthz>;
    }
  }
}

export function loadAdminAuthz(req: Request, res: Response, next: NextFunction): void {
  try {
    const userId = resolveAdminActorId(req);
    req.adminAuthz = resolveAdminAuthz({
      userId,
      profileRole: localPlatformAdminProfileRole(req),
      jwtRole: (req.authUser?.app_metadata as { role?: string } | undefined)?.role ?? null,
    });
    next();
  } catch {
    apiError(res, 401, "error.unauthorized");
  }
}

export function requirePermission(permission: AdminPermission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.adminAuthz) {
        apiError(res, 401, "error.unauthorized");
        return;
      }
      assertPermission(req.adminAuthz, permission);
      if (STEP_UP_PERMISSIONS.has(permission) && (permission === "publish.production" || permission === "publish.rollback" || permission === "access.role.grant" || permission === "secret.write_once")) {
        const expected = process.env.INTERNAL_API_SECRET?.trim();
        if (expected) {
          const got = String(req.headers["x-reauth-token"] || "").trim();
          if (!got || got !== expected) {
            apiError(res, 401, "error.unauthorized");
            return;
          }
        }
      }
      next();
    } catch {
      apiError(res, 403, "error.forbidden");
    }
  };
}

export function requireEnvironmentScope(req: Request, res: Response, next: NextFunction): void {
  const env = String(req.body?.targetEnvironment || req.query.environment || req.adminAuthz?.environment || detectAdminEnvironment());
  if (env === "production" && detectAdminEnvironment() !== "production" && String(req.path || "").includes("publish")) {
    apiError(res, 409, "error.conflict");
    return;
  }
  next();
}
