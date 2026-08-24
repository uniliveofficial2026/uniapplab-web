import type { Request } from "express";

export function clientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "anon"
  );
}

export function isLoopbackIp(ip: string): boolean {
  const value = ip.replace(/^::ffff:/, "").toLowerCase();
  return value === "127.0.0.1" || value === "::1" || value === "localhost" || value === "0.0.0.0";
}

export function isLocalRuntime(): boolean {
  const explicit = String(process.env.UNILIVE_RUNTIME_ENV || "").trim();
  if (explicit === "local" || explicit === "test") return true;
  if (explicit === "preview" || explicit === "staging" || explicit === "production") return false;
  if (process.env.NODE_ENV === "test") return true;
  if (process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "production" && process.env.VERCEL === "1") return false;
  return true;
}

function requestPath(req: Request): string {
  return [req.originalUrl, req.url, req.path]
    .filter(Boolean)
    .map((value) => String(value).split("?")[0])
    .join(" ");
}

export function isAdminApiPath(req: Request): boolean {
  const path = requestPath(req);
  return path.includes("/api/admin/") || path.includes("/admin/");
}

export function isAdminPollPath(req: Request): boolean {
  const path = requestPath(req);
  return /\/dev-agent\/(tasks|ports|detect|sessions|proactive|memory|omni\/catalog|providers)(\/|$)/.test(path);
}

/** Global Upstash limiter — skip local studio, loopback, and authenticated admin APIs. */
export function shouldSkipGlobalRateLimit(req: Request): boolean {
  if (isLocalRuntime()) return true;
  if (isLoopbackIp(clientIp(req))) return true;
  const path = requestPath(req);
  if (path.includes("/discord/interactions")) return true;
  if (isAdminApiPath(req)) return true;
  return false;
}

/** Admin control-plane limiter — skip local and high-frequency GET polls. */
export function shouldSkipControlPlaneRateLimit(req: Request): boolean {
  if (isLocalRuntime()) return true;
  if (isLoopbackIp(clientIp(req))) return true;
  if (req.method === "GET" && isAdminPollPath(req)) return true;
  return false;
}
