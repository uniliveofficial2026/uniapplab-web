import { Router, type IRouter } from "express";
import { requirePermission } from "../../middlewares/requirePermission";
import {
  benchmarkChangeSet,
  getPerformanceForResource,
  overridePerformanceGate,
} from "../../domain/admin-control-plane/content/PerformanceCertificationService";
import { compileRuntimeBundle, listRuntimeBundles } from "../../domain/admin-control-plane/content/RuntimeBundleCompiler";
import { compileAndPublish } from "../../domain/admin-control-plane/content/RuntimeBundlePublicationService";
import { ingestSloSample, listSloAggregates, loadSloContract } from "../../lib/performance/sloMetrics";

const router: IRouter = Router();

router.get("/slo", requirePermission("performance.read"), (_req, res, next) => {
  try {
    const contract = loadSloContract();
    res.json({
      brand: "UniLive’s",
      slo: "one-second-experience",
      contract,
      aggregates: listSloAggregates(),
    });
  } catch (e) {
    next(e);
  }
});

router.post("/slo/samples", requirePermission("performance.benchmark"), (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.samples) ? req.body.samples : [req.body];
    const results = items.map((item: unknown) => ingestSloSample(item));
    res.status(202).json({ ok: results.every((r: { ok: boolean }) => r.ok), results });
  } catch (e) {
    next(e);
  }
});

router.get("/resources/:id/performance", requirePermission("performance.read"), (req, res, next) => {
  try {
    res.json({ items: getPerformanceForResource(String(req.params.id)) });
  } catch (e) {
    next(e);
  }
});

router.post("/change-sets/:id/benchmark", requirePermission("performance.benchmark"), (req, res, next) => {
  try {
    res.json(benchmarkChangeSet(String(req.params.id), req.adminAuthz!.userId, req.body?.metrics || req.body || {}));
  } catch (e) {
    next(e);
  }
});

router.post("/reports/:id/override", requirePermission("performance.override"), (req, res, next) => {
  try {
    res.json(
      overridePerformanceGate(
        String(req.params.id),
        String(req.body?.gate || ""),
        String(req.body?.reason || ""),
        String(req.body?.expiresAt || new Date(Date.now() + 86400000).toISOString()),
        req.adminAuthz!.userId,
      ),
    );
  } catch (e) {
    next(e);
  }
});

router.get("/runtime-bundles", requirePermission("performance.read"), (_req, res, next) => {
  try {
    res.json({ items: listRuntimeBundles() });
  } catch (e) {
    next(e);
  }
});

router.post("/runtime-bundles/compile", requirePermission("rollout.create"), (req, res, next) => {
  try {
    res.status(201).json(compileRuntimeBundle({ actorId: req.adminAuthz!.userId, snapshotId: req.body?.snapshotId }));
  } catch (e) {
    next(e);
  }
});

router.post("/runtime-bundles/publish", requirePermission("rollout.create"), (req, res, next) => {
  try {
    res.json(compileAndPublish(req.adminAuthz!.userId, req.body?.snapshotId));
  } catch (e) {
    next(e);
  }
});

export default router;
