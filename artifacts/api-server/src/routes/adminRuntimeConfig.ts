import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { auth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { apiError } from "../lib/apiError";
import { shouldSkipControlPlaneRateLimit } from "../lib/rateLimitPolicy";
import {
  activateConfigVersion,
  createConfigVersion,
  detectRuntimeEnvironment,
  ensureBaseline,
  healthCheckVersion,
  listConfigAudit,
  listConfigVersions,
  listDefinitions,
  listProviderAdapters,
  rollbackConfigVersion,
  validateConfigVersion,
} from "../config";
import { getVersion } from "../config/configRepository";
import { redactErrorMessage, redactRecord } from "../config/redaction";
import type { RuntimeEnvironment } from "../config/types";

const router: IRouter = Router();

const hits = new Map<string, { n: number; t: number }>();
function rateLimit(req: Request, res: Response, next: NextFunction): void {
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
  if (rec.n > 300) {
    apiError(res, 429, "error.rateLimited");
    return;
  }
  next();
}

function requireReauth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.INTERNAL_API_SECRET?.trim();
  if (!expected) {
    next();
    return;
  }
  const got = String(req.headers["x-reauth-token"] || "").trim();
  if (!got || got !== expected) {
    apiError(res, 401, "error.unauthorized");
    return;
  }
  next();
}

router.use(auth, requireNotBanned, requireAdmin, rateLimit);

function envParam(req: Request): RuntimeEnvironment | undefined {
  const raw = String(req.query.environment || "").trim();
  if (!raw) return undefined;
  if (raw === "local" || raw === "test" || raw === "preview" || raw === "staging" || raw === "production") return raw;
  return undefined;
}

router.get("/definitions", (_req, res) => {
  ensureBaseline();
  res.json({ items: listDefinitions(), providers: listProviderAdapters() });
});

router.get("/versions", (req, res) => {
  ensureBaseline();
  res.json({ environment: envParam(req) || detectRuntimeEnvironment(), items: listConfigVersions(envParam(req)) });
});

router.post("/versions", (req, res, next) => {
  try {
    ensureBaseline();
    if (req.body?.secrets || req.body?.secretValues || req.body?.value) {
      apiError(res, 400, "error.server");
      return;
    }
    const rec = createConfigVersion({
      environment: (req.body?.environment as RuntimeEnvironment) || detectRuntimeEnvironment(),
      bindings: req.body?.bindings || {},
      publicValues: req.body?.publicValues || {},
      actor: req.authUser!.id,
      reason: req.body?.reason,
    });
    res.status(201).json({
      id: rec.id,
      version: rec.version,
      status: rec.status,
      checksum: rec.checksum,
      environment: rec.environment,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/versions/:id/validate", (req, res, next) => {
  try {
    const rec = validateConfigVersion(String(req.params.id));
    res.json({ id: rec.id, status: rec.status, checksum: rec.checksum });
  } catch (err) {
    next(err);
  }
});

router.post("/versions/:id/health-check", (req, res, next) => {
  try {
    const rec = getVersion(String(req.params.id));
    if (!rec) {
      apiError(res, 404, "error.notFound");
      return;
    }
    const health = healthCheckVersion(rec);
    res.json({ ok: health.ok, results: health.results });
  } catch (err) {
    next(err);
  }
});

router.post("/versions/:id/activate", requireReauth, (req, res, next) => {
  try {
    const rec = activateConfigVersion(
      String(req.params.id),
      req.authUser!.id,
      req.body?.reason,
      String(req.headers["if-match"] || ""),
    );
    res.json({ id: rec.id, status: rec.status, checksum: rec.checksum, environment: rec.environment });
  } catch (err) {
    next(err);
  }
});

router.post("/versions/:id/rollback", requireReauth, (req, res, next) => {
  try {
    const rec = rollbackConfigVersion(String(req.params.id), req.authUser!.id, req.body?.reason);
    res.json({ id: rec.id, status: rec.status, checksum: rec.checksum, environment: rec.environment });
  } catch (err) {
    next(err);
  }
});

router.get("/audit", (_req, res) => {
  res.json({ items: listConfigAudit().map((r) => redactRecord(r as unknown as Record<string, unknown>)) });
});

router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const msg = redactErrorMessage(err.message || "error");
  if (msg.includes("unknown config") || msg.includes("invalid secret") || msg.includes("not accepted")) {
    res.status(400).json({ error: msg });
    return;
  }
  if (msg.includes("not found")) {
    apiError(res, 404, "error.notFound");
    return;
  }
  if (msg.includes("production") || msg.includes("concurrency") || msg.includes("health check")) {
    res.status(409).json({ error: msg });
    return;
  }
  res.status(500).json({ error: msg });
});

export default router;
