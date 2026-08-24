import type { NextFunction, Request, Response } from "express";
import { apiError } from "../../lib/apiError";
import { redactErrorMessage } from "../../config/redaction";
import { shouldSkipControlPlaneRateLimit } from "../../lib/rateLimitPolicy";

export function handleControlPlaneError(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const e = err as { status?: number; code?: string; message?: string; issues?: unknown; name?: string };
  const msg = redactErrorMessage(e.message || "error");
  if (e.status === 401) {
    apiError(res, 401, e.code || "error.unauthorized");
    return;
  }
  if (e.status === 403) {
    apiError(res, 403, e.code || "error.forbidden");
    return;
  }
  if (e.status === 404) {
    apiError(res, 404, e.code || "error.notFound");
    return;
  }
  if (e.status === 409) {
    res.status(409).json({ error: msg, code: e.code || "error.conflict" });
    return;
  }
  if (e.status === 400 || e.name === "ZodError") {
    res.status(400).json({ error: msg, code: e.code || "error.invalid", issues: e.issues });
    return;
  }
  res.status(500).json({ error: msg });
}

const hits = new Map<string, { n: number; t: number }>();
export function controlPlaneRateLimit(req: Request, res: Response, next: NextFunction): void {
  if (shouldSkipControlPlaneRateLimit(req)) {
    next();
    return;
  }
  const key = req.authUser?.id || req.ip || "anon";
  const now = Date.now();
  const rec = hits.get(key) || { n: 0, t: now };
  if (now - rec.t > 60_000) {
    rec.n = 0;
    rec.t = now;
  }
  rec.n += 1;
  hits.set(key, rec);
  if (rec.n > 600) {
    apiError(res, 429, "error.rateLimited");
    return;
  }
  next();
}
