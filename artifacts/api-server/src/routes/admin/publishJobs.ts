import { Router, type IRouter } from "express";
import { requirePermission } from "../../middlewares/requirePermission";
import { getPublishJob } from "../../domain/admin-control-plane";

const router: IRouter = Router();

router.get("/:id", requirePermission("audit.read"), (req, res, next) => {
  try {
    res.json(getPublishJob(String(req.params.id)));
  } catch (e) {
    next(e);
  }
});

export default router;
