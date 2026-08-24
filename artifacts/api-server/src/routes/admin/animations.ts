import { Router, type IRouter } from "express";
import { requirePermission } from "../../middlewares/requirePermission";
import {
  createAnimationDraft,
  listAnimationDrafts,
  patchAnimationDraft,
  validateAnimationDraft,
} from "../../domain/admin-control-plane/content/AnimationAdminService";

const router: IRouter = Router();

router.get("/drafts", requirePermission("animation.read"), (_req, res, next) => {
  try {
    res.json({ items: listAnimationDrafts() });
  } catch (e) {
    next(e);
  }
});

router.post("/drafts", requirePermission("animation.edit"), (req, res, next) => {
  try {
    res.status(201).json(createAnimationDraft(req.body || {}, req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.patch("/drafts/:id", requirePermission("animation.edit"), (req, res, next) => {
  try {
    res.json(patchAnimationDraft(String(req.params.id), req.body?.patch || req.body || {}, Number(req.body?.expectedRevision || 1), req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.post("/drafts/:id/validate", requirePermission("animation.edit"), (req, res, next) => {
  try {
    res.json(validateAnimationDraft(String(req.params.id)));
  } catch (e) {
    next(e);
  }
});

export default router;
