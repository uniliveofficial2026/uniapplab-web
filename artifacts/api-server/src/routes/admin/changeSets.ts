import { Router, type IRouter } from "express";
import { requirePermission } from "../../middlewares/requirePermission";
import {
  addOrUpdateItem,
  cancelChangeSet,
  createChangeSet,
  createPreview,
  deleteItem,
  dependencyImpact,
  getChangeSet,
  listChangeSets,
  listItems,
  listPreviews,
  patchChangeSet,
  publishChangeSet,
  reviewChangeSet,
  rollbackChangeSet,
  submitChangeSet,
  validateChangeSet,
} from "../../domain/admin-control-plane";
import { publishPermissionForEnvironment } from "../../domain/admin-control-plane/adminPermissionPolicy";

const router: IRouter = Router();

router.get("/", requirePermission("change_set.read"), (req, res, next) => {
  try {
    const env = typeof req.query.environment === "string" ? req.query.environment : undefined;
    res.json({
      items: listChangeSets(env as never),
    });
  } catch (e) {
    next(e);
  }
});

router.post("/", requirePermission("change_set.create"), (req, res, next) => {
  try {
    const rec = createChangeSet(req.body, req.adminAuthz!.userId);
    res.status(201).json(rec);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requirePermission("change_set.read"), (req, res, next) => {
  try {
    const rec = getChangeSet(String(req.params.id));
    res.json({ changeSet: rec, items: listItems(rec.id), impact: dependencyImpact(rec.id), previews: listPreviews(rec.id) });
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", requirePermission("change_set.edit_own"), (req, res, next) => {
  try {
    const rec = patchChangeSet(String(req.params.id), req.body, req.adminAuthz!.userId, req.adminAuthz!.roles.includes("super_admin"));
    res.json(rec);
  } catch (e) {
    next(e);
  }
});

router.post("/:id/items", requirePermission("change_set.edit_own"), (req, res, next) => {
  try {
    const item = addOrUpdateItem(String(req.params.id), req.body, req.adminAuthz!.userId);
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/items/:itemId", requirePermission("change_set.edit_own"), (req, res, next) => {
  try {
    const item = addOrUpdateItem(String(req.params.id), { ...req.body, expectedRevision: req.body?.expectedRevision }, req.adminAuthz!.userId);
    res.json(item);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id/items/:itemId", requirePermission("change_set.edit_own"), (req, res, next) => {
  try {
    deleteItem(String(req.params.id), String(req.params.itemId), req.adminAuthz!.userId);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/validate", requirePermission("change_set.submit"), (req, res, next) => {
  try {
    res.json(validateChangeSet(String(req.params.id), req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.post("/:id/create-preview", requirePermission("session.preview"), (req, res, next) => {
  try {
    res.json(createPreview(String(req.params.id), req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.post("/:id/submit", requirePermission("change_set.submit"), (req, res, next) => {
  try {
    const expectedRevision = Number(req.body?.expectedRevision);
    res.json(submitChangeSet(String(req.params.id), req.adminAuthz!.userId, expectedRevision));
  } catch (e) {
    next(e);
  }
});

router.post("/:id/approve", requirePermission("review.approve"), (req, res, next) => {
  try {
    res.json(reviewChangeSet(String(req.params.id), { ...req.body, decision: "approve" }, req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.post("/:id/reject", requirePermission("review.reject"), (req, res, next) => {
  try {
    res.json(reviewChangeSet(String(req.params.id), { ...req.body, decision: "reject" }, req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.post("/:id/publish", (req, res, next) => {
  try {
    const rec = getChangeSet(String(req.params.id));
    const perm = publishPermissionForEnvironment(rec.targetEnvironment);
    requirePermission(perm)(req, res, (err) => {
      if (err) return next(err);
      try {
        res.json(publishChangeSet(String(req.params.id), req.body, req.adminAuthz!.userId));
      } catch (e) {
        next(e);
      }
    });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/rollback", requirePermission("publish.rollback"), (req, res, next) => {
  try {
    res.json(rollbackChangeSet(String(req.params.id), req.body, req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.post("/:id/cancel", requirePermission("change_set.cancel"), (req, res, next) => {
  try {
    res.json(cancelChangeSet(String(req.params.id), req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

export default router;
