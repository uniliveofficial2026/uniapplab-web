import { Router, type IRouter } from "express";
import { requirePermission } from "../../middlewares/requirePermission";
import { listAudit } from "../../domain/admin-control-plane";

const router: IRouter = Router();

router.get("/", requirePermission("audit.read"), (_req, res) => {
  res.json({ items: listAudit() });
});

export default router;
