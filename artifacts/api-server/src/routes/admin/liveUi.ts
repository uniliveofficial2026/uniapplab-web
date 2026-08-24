import { Router, type IRouter } from "express";
import { requirePermission } from "../../middlewares/requirePermission";
import {
  assignLiveExperienceSnapshot,
  getLiveUiRegistry,
  liveCompatibilityMatrix,
  listLiveActionsAdmin,
  listLiveAssignments,
  listLiveBindingsAdmin,
  listLiveExperiencesAdmin,
  listLiveLayoutsAdmin,
  listLiveNodesAdmin,
  validateLiveUiPatch,
} from "../../domain/admin-control-plane/live-ui/LiveUiAccessService";
import { resolveLiveExperienceAssignment } from "../../domain/admin-control-plane/live-ui/LiveExperienceAssignmentService";

const router: IRouter = Router();

router.get("/registry", requirePermission("ui.experience.read"), (_req, res) => {
  res.json(getLiveUiRegistry());
});

router.get("/experiences", requirePermission("ui.experience.read"), (_req, res) => {
  res.json({ items: listLiveExperiencesAdmin() });
});

router.get("/nodes", requirePermission("ui.experience.read"), (_req, res) => {
  res.json({ items: listLiveNodesAdmin() });
});

router.get("/layouts", requirePermission("ui.experience.read"), (_req, res) => {
  res.json({ items: listLiveLayoutsAdmin() });
});

router.get("/actions", requirePermission("ui.experience.read"), (_req, res) => {
  res.json({ items: listLiveActionsAdmin() });
});

router.get("/bindings", requirePermission("ui.experience.read"), (_req, res) => {
  res.json({ items: listLiveBindingsAdmin() });
});

router.get("/compatibility", requirePermission("ui.experience.read"), (_req, res) => {
  res.json({ items: liveCompatibilityMatrix() });
});

router.post("/validate", requirePermission("ui.experience.edit"), (req, res) => {
  res.json(validateLiveUiPatch(req.body));
});

router.post("/resolve", requirePermission("session.preview"), (req, res, next) => {
  try {
    res.json(resolveLiveExperienceAssignment(req.body || {}));
  } catch (e) {
    next(e);
  }
});

router.get("/assignments", requirePermission("session.assign"), (_req, res) => {
  res.json({ items: listLiveAssignments() });
});

router.post("/assignments", requirePermission("session.assign"), (req, res, next) => {
  try {
    res.status(201).json(assignLiveExperienceSnapshot(req.body, req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

export default router;
