import { Router, type IRouter } from "express";
import { requirePermission } from "../../middlewares/requirePermission";
import { createAssignment, disableAssignment, listAssignments } from "../../domain/admin-control-plane";

const router: IRouter = Router();

router.get("/", requirePermission("session.assign"), (_req, res) => {
  res.json({ items: listAssignments() });
});

router.post("/", requirePermission("session.assign"), (req, res, next) => {
  try {
    res.status(201).json(createAssignment(req.body, req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.post("/:id/disable", requirePermission("session.end"), (req, res, next) => {
  try {
    res.json(disableAssignment(String(req.params.id), req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

export default router;
