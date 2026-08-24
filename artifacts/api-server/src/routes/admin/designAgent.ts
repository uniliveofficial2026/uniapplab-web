import { Router, type IRouter } from "express";
import { requirePermission } from "../../middlewares/requirePermission";
import { isDevWorkspaceEnabled } from "../../domain/admin-control-plane/workspaceConfigService";
import { importDesignAgent, readDesignAgentJob } from "../../domain/admin-control-plane/designAgentService";
import { apiError } from "../../lib/apiError";

const router: IRouter = Router();

function workspaceGate(_req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  if (!isDevWorkspaceEnabled()) {
    apiError(res, 404, "error.notFound");
    return;
  }
  next();
}

router.post("/import", requirePermission("ui.experience.edit"), workspaceGate, async (req, res, next) => {
  try {
    const body = req.body as {
      fileName?: string;
      mimeType?: string;
      dataBase64?: string;
      screenName?: string;
      targetResourceId?: string | null;
    };
    if (!body.fileName || !body.mimeType || !body.dataBase64) {
      apiError(res, 400, "design.invalid");
      return;
    }
    const job = await importDesignAgent({
      fileName: String(body.fileName),
      mimeType: String(body.mimeType),
      dataBase64: String(body.dataBase64),
      screenName: body.screenName,
      targetResourceId: body.targetResourceId,
      actorId: req.adminAuthz!.userId,
    });
    res.status(201).json(job);
  } catch (e) {
    next(e);
  }
});

router.get("/jobs/:id", requirePermission("ui.experience.read"), workspaceGate, (req, res, next) => {
  try {
    const job = readDesignAgentJob(String(req.params.id));
    if (!job) {
      apiError(res, 404, "error.notFound");
      return;
    }
    res.json(job);
  } catch (e) {
    next(e);
  }
});

router.get("/jobs/:id/preview", requirePermission("ui.experience.read"), workspaceGate, (req, res, next) => {
  try {
    const job = readDesignAgentJob(String(req.params.id));
    if (!job?.previewHtml) {
      apiError(res, 404, "error.notFound");
      return;
    }
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "private, max-age=60");
    res.send(job.previewHtml);
  } catch (e) {
    next(e);
  }
});

export default router;
