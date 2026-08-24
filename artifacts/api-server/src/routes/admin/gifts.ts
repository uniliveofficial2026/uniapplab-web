import { Router, type IRouter } from "express";
import { requirePermission } from "../../middlewares/requirePermission";
import {
  createGiftDraft,
  createGiftPricingDraft,
  listGiftDrafts,
  patchGiftDraft,
  validateGiftDraft,
} from "../../domain/admin-control-plane/content/GiftAdminService";

const router: IRouter = Router();

router.get("/drafts", requirePermission("gift.catalog.read"), (_req, res, next) => {
  try {
    res.json({ items: listGiftDrafts() });
  } catch (e) {
    next(e);
  }
});

router.post("/drafts", requirePermission("gift.catalog.edit"), (req, res, next) => {
  try {
    res.status(201).json(createGiftDraft(req.body || {}, req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.post("/pricing-drafts", requirePermission("gift.pricing.edit"), (req, res, next) => {
  try {
    res.status(201).json(createGiftPricingDraft(req.body || {}, req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.patch("/drafts/:id", requirePermission("gift.catalog.edit"), (req, res, next) => {
  try {
    res.json(patchGiftDraft(String(req.params.id), req.body?.patch || req.body || {}, Number(req.body?.expectedRevision || 1), req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.post("/drafts/:id/validate", requirePermission("gift.catalog.edit"), (req, res, next) => {
  try {
    res.json(validateGiftDraft(String(req.params.id)));
  } catch (e) {
    next(e);
  }
});

export default router;
