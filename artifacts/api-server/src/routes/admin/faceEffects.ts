import { Router, type IRouter } from "express";
import { requirePermission } from "../../middlewares/requirePermission";
import {
  createFaceEffectDraft,
  listFaceEffectDrafts,
  patchFaceEffectDraft,
  validateFaceEffectDraft,
} from "../../domain/admin-control-plane/content/FaceEffectAdminService";

const router: IRouter = Router();

router.get("/drafts", requirePermission("face_effect.read"), (_req, res, next) => {
  try {
    res.json({ items: listFaceEffectDrafts() });
  } catch (e) {
    next(e);
  }
});

router.post("/drafts", requirePermission("face_effect.edit"), (req, res, next) => {
  try {
    res.status(201).json(createFaceEffectDraft(req.body || {}, req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.patch("/drafts/:id", requirePermission("face_effect.edit"), (req, res, next) => {
  try {
    res.json(patchFaceEffectDraft(String(req.params.id), req.body?.patch || req.body || {}, Number(req.body?.expectedRevision || 1), req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.post("/drafts/:id/validate", requirePermission("face_effect.edit"), (req, res, next) => {
  try {
    res.json(validateFaceEffectDraft(String(req.params.id)));
  } catch (e) {
    next(e);
  }
});

export default router;
