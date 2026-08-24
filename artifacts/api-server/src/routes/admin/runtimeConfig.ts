import { Router, type IRouter } from "express";
import { requirePermission } from "../../middlewares/requirePermission";
import { listFeatureFlags, listRuntimeDefinitions } from "../../domain/admin-control-plane/uiCatalogReadService";
import { controlPlaneHealth, editSecretReference, listSecretMetadata } from "../../domain/admin-control-plane";
import { listConfigVersions } from "../../config";

const router: IRouter = Router();

router.get("/", (req, res, next) => {
  const secretLane = String(req.baseUrl || "").includes("secret-references");
  if (secretLane) {
    requirePermission("secret.metadata.read")(req, res, (err) => {
      if (err) return next(err);
      try {
        res.json({ items: listSecretMetadata() });
      } catch (e) {
        next(e);
      }
    });
    return;
  }
  requirePermission("config.read")(req, res, (err) => {
    if (err) return next(err);
    try {
      res.json({ items: listFeatureFlags(), definitions: listRuntimeDefinitions(), versions: listConfigVersions() });
    } catch (e) {
      next(e);
    }
  });
});

router.post("/", requirePermission("secret.reference.edit"), (req, res, next) => {
  try {
    res.json(editSecretReference(req.body));
  } catch (e) {
    next(e);
  }
});

router.post("/health-check", requirePermission("config.validate"), async (_req, res, next) => {
  try {
    res.json(await controlPlaneHealth());
  } catch (e) {
    next(e);
  }
});

export default router;
