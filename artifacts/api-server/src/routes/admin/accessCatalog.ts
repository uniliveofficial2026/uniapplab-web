import { Router, type IRouter } from "express";
import { requirePermission } from "../../middlewares/requirePermission";
import {
  assertCanReadResource,
  createResourceDraft,
  getAdminResource,
  getDraft,
  listAdminResources,
  patchDraft,
  resourceDetail,
} from "../../domain/admin-control-plane/access/AdminAccessService";
import { consumersFor, dependenciesFor } from "../../domain/admin-control-plane/access/AdminDependencyService";
import { historyFor } from "../../domain/admin-control-plane/access/AdminAccessAuditService";
import { validateAccessChangeSet } from "../../domain/admin-control-plane/access/AdminValidationService";
import { createAccessPreview } from "../../domain/admin-control-plane/access/AdminPreviewService";
import { getPublishJob, publishAccessChangeSet } from "../../domain/admin-control-plane/access/AdminPublicationService";
import { rollbackAccessChangeSet } from "../../domain/admin-control-plane/access/AdminRollbackService";
import { reviewChangeSet, submitChangeSet } from "../../domain/admin-control-plane";
import { publishPermissionForEnvironment } from "../../domain/admin-control-plane/adminPermissionPolicy";
import { getChangeSet } from "../../domain/admin-control-plane/changeSetService";

const router: IRouter = Router();

router.get("/resources", requirePermission("admin.dashboard.read"), (req, res, next) => {
  try {
    const items = listAdminResources({
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      type: typeof req.query.type === "string" ? req.query.type : undefined,
      domain: typeof req.query.domain === "string" ? req.query.domain : undefined,
      experience: typeof req.query.experience === "string" ? req.query.experience : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      permission: typeof req.query.permission === "string" ? req.query.permission : undefined,
      releaseRequirement: typeof req.query.releaseRequirement === "string" ? req.query.releaseRequirement : undefined,
      missingFallback: req.query.missingFallback === "1" || req.query.missingFallback === "true",
    });
    res.json({ count: items.length, items });
  } catch (e) {
    next(e);
  }
});

router.get("/resources/:resourceId/dependencies", requirePermission("ui.experience.read"), (req, res, next) => {
  try {
    res.json(dependenciesFor(String(req.params.resourceId)));
  } catch (e) {
    next(e);
  }
});

router.get("/resources/:resourceId/consumers", requirePermission("ui.experience.read"), (req, res, next) => {
  try {
    res.json(consumersFor(String(req.params.resourceId)));
  } catch (e) {
    next(e);
  }
});

router.get("/resources/:resourceId/history", requirePermission("audit.read"), (req, res, next) => {
  try {
    res.json({ items: historyFor(String(req.params.resourceId)) });
  } catch (e) {
    next(e);
  }
});

router.get("/resources/:resourceId", requirePermission("admin.dashboard.read"), (req, res, next) => {
  try {
    const rec = getAdminResource(String(req.params.resourceId));
    assertCanReadResource(req.adminAuthz!, rec);
    res.json(resourceDetail(rec.resourceId));
  } catch (e) {
    next(e);
  }
});

router.post("/resources/:resourceId/drafts", requirePermission("change_set.create"), (req, res, next) => {
  try {
    const draft = createResourceDraft(String(req.params.resourceId), req.body, req.adminAuthz!.userId, req.adminAuthz!);
    res.status(201).json(draft);
  } catch (e) {
    next(e);
  }
});

router.patch("/drafts/:draftId", requirePermission("change_set.edit_own"), (req, res, next) => {
  try {
    res.json(patchDraft(String(req.params.draftId), req.body, req.adminAuthz!.userId, req.adminAuthz!));
  } catch (e) {
    next(e);
  }
});

router.post("/drafts/:draftId/validate", requirePermission("change_set.submit"), (req, res, next) => {
  try {
    const draft = getDraft(String(req.params.draftId));
    res.json(validateAccessChangeSet(draft.changeSetId, req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.post("/change-sets/:id/preview", requirePermission("session.preview"), (req, res, next) => {
  try {
    res.json(createAccessPreview(String(req.params.id), req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.post("/change-sets/:id/submit", requirePermission("change_set.submit"), (req, res, next) => {
  try {
    const expectedRevision = Number(req.body?.expectedRevision);
    res.json(submitChangeSet(String(req.params.id), req.adminAuthz!.userId, expectedRevision));
  } catch (e) {
    next(e);
  }
});

router.post("/change-sets/:id/approve", requirePermission("review.approve"), (req, res, next) => {
  try {
    res.json(reviewChangeSet(String(req.params.id), { ...req.body, decision: "approve" }, req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.post("/change-sets/:id/reject", requirePermission("review.reject"), (req, res, next) => {
  try {
    res.json(reviewChangeSet(String(req.params.id), { ...req.body, decision: "reject" }, req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.post("/change-sets/:id/publish", (req, res, next) => {
  try {
    const rec = getChangeSet(String(req.params.id));
    const perm = publishPermissionForEnvironment(rec.targetEnvironment);
    requirePermission(perm)(req, res, (err) => {
      if (err) return next(err);
      try {
        res.json(publishAccessChangeSet(String(req.params.id), req.body, req.adminAuthz!.userId));
      } catch (e) {
        next(e);
      }
    });
  } catch (e) {
    next(e);
  }
});

router.post("/publications/:id/rollback", requirePermission("publish.rollback"), (req, res, next) => {
  try {
    const job = getPublishJob(String(req.params.id));
    res.json(rollbackAccessChangeSet(job.changeSetId, req.body, req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.get("/publications/:id/status", requirePermission("audit.read"), (req, res, next) => {
  try {
    res.json(getPublishJob(String(req.params.id)));
  } catch (e) {
    next(e);
  }
});

export default router;
