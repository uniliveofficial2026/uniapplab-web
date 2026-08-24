import { Router, type IRouter } from "express";
import { requirePermission } from "../../middlewares/requirePermission";
import {
  isDevWorkspaceEnabled,
  publicWorkspaceBootstrap,
  readWorkspaceConfig,
  THIRD_PARTY_PRESETS,
  upsertThirdPartyProvider,
  writeWorkspaceConfig,
  type WorkspaceConfig,
} from "../../domain/admin-control-plane/workspaceConfigService";
import { apiError } from "../../lib/apiError";

const router: IRouter = Router();

function workspaceGate(_req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  if (!isDevWorkspaceEnabled()) {
    apiError(res, 404, "error.notFound");
    return;
  }
  next();
}

router.get("/bootstrap", requirePermission("ui.experience.read"), workspaceGate, (_req, res) => {
  res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
  res.json(publicWorkspaceBootstrap());
});

router.get("/", requirePermission("ui.experience.read"), workspaceGate, (_req, res) => {
  res.json({ config: readWorkspaceConfig(), presets: THIRD_PARTY_PRESETS });
});

router.put("/", requirePermission("ui.experience.edit"), workspaceGate, (req, res, next) => {
  try {
    const body = req.body as Partial<WorkspaceConfig>;
    res.json(writeWorkspaceConfig(body));
  } catch (e) {
    next(e);
  }
});

router.post("/third-party/:providerId", requirePermission("ui.experience.edit"), workspaceGate, (req, res, next) => {
  try {
    const body = req.body as { enabled?: boolean; fields?: Record<string, string> };
    res.json(upsertThirdPartyProvider(String(req.params.providerId), body));
  } catch (e) {
    next(e);
  }
});

export default router;
