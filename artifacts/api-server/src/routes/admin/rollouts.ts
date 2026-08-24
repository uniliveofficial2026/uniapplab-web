import { Router, type IRouter } from "express";
import { requirePermission } from "../../middlewares/requirePermission";
import {
  advanceCanary,
  createCanary,
  getCanary,
  pauseCanary,
  reportCanaryMetrics,
  resumeCanary,
} from "../../domain/admin-control-plane/content/CanaryRolloutService";
import { getPublicationHealth, recordHealthEvent } from "../../domain/admin-control-plane/content/PublicationHealthService";
import { rollbackPublication } from "../../domain/admin-control-plane/content/RuntimeRollbackService";

const router: IRouter = Router();

router.post("/change-sets/:id/canary", requirePermission("rollout.create"), (req, res, next) => {
  try {
    res.status(201).json(createCanary(String(req.params.id), req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.get("/publications/:id/health", requirePermission("performance.read"), (req, res, next) => {
  try {
    res.json(getPublicationHealth(String(req.params.id)));
  } catch (e) {
    next(e);
  }
});

router.post("/publications/:id/health", requirePermission("performance.read"), (req, res, next) => {
  try {
    res.json(recordHealthEvent(String(req.params.id), req.body || {}));
  } catch (e) {
    next(e);
  }
});

router.post("/publications/:id/pause", requirePermission("rollout.pause"), (req, res, next) => {
  try {
    res.json(pauseCanary(String(req.params.id), req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.post("/publications/:id/resume", requirePermission("rollout.resume"), (req, res, next) => {
  try {
    res.json(resumeCanary(String(req.params.id), req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.post("/publications/:id/rollback", requirePermission("rollout.rollback"), (req, res, next) => {
  try {
    res.json(rollbackPublication(String(req.params.id), req.body || {}, req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.post("/publications/:id/advance", requirePermission("rollout.create"), (req, res, next) => {
  try {
    res.json(advanceCanary(String(req.params.id), req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.post("/publications/:id/metrics", requirePermission("performance.read"), (req, res, next) => {
  try {
    res.json(reportCanaryMetrics(String(req.params.id), req.body || {}));
  } catch (e) {
    next(e);
  }
});

router.get("/publications/:id", requirePermission("performance.read"), (req, res, next) => {
  try {
    res.json(getCanary(String(req.params.id)));
  } catch (e) {
    next(e);
  }
});

export default router;
