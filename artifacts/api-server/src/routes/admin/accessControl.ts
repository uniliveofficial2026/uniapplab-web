import { Router, type IRouter } from "express";
import { requirePermission } from "../../middlewares/requirePermission";
import { ADMIN_PERMISSIONS, ROLE_PERMISSIONS } from "../../domain/admin-control-plane/adminPermissionPolicy";
import { grantRole, listUserRoles, revokeRole } from "../../domain/admin-control-plane";

const router: IRouter = Router();

router.get("/roles", requirePermission("access.role.read"), (_req, res) => {
  res.json({ roles: ROLE_PERMISSIONS, permissions: ADMIN_PERMISSIONS, grants: listUserRoles() });
});

router.post("/roles", requirePermission("access.role.grant"), (req, res, next) => {
  try {
    if (req.adminAuthz!.roles.includes("publisher") && !req.adminAuthz!.roles.includes("security_admin") && !req.adminAuthz!.roles.includes("super_admin")) {
      res.status(403).json({ error: "publisher cannot grant roles", code: "error.forbidden" });
      return;
    }
    res.status(201).json(grantRole(req.body, req.adminAuthz!.userId, true));
  } catch (e) {
    next(e);
  }
});

router.post("/roles/:id/revoke", requirePermission("access.role.revoke"), (req, res, next) => {
  try {
    res.json(revokeRole(String(req.params.id), req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

export default router;
