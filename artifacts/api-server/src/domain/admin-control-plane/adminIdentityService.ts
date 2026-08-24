import type { Request } from "express";

/** Canonical internal user_id only. Client-supplied ids/roles are ignored. */
export function resolveAdminActorId(req: Request): string {
  const id = req.authUser?.id?.trim();
  if (!id) throw Object.assign(new Error("unauthenticated"), { status: 401, code: "error.unauthorized" });
  return id;
}

export function detectAdminEnvironment(): "local" | "test" | "preview" | "staging" | "production" {
  const explicit = String(process.env.UNILIVE_RUNTIME_ENV || "").trim();
  if (explicit === "local" || explicit === "test" || explicit === "preview" || explicit === "staging" || explicit === "production") {
    return explicit;
  }
  if (process.env.NODE_ENV === "test") return "test";
  if (process.env.VERCEL_ENV === "preview") return "preview";
  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.NODE_ENV === "production" && process.env.VERCEL === "1") return "production";
  return "local";
}

export function isProductionRuntime(): boolean {
  return detectAdminEnvironment() === "production";
}
