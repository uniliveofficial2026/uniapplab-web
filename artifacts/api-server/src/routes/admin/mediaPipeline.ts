import { Router, type IRouter } from "express";
import { requirePermission } from "../../middlewares/requirePermission";
import {
  createMediaUploadIntent,
  getMediaJob,
  runMediaJob,
  validateMediaPayload,
} from "../../domain/admin-control-plane/content/MediaProcessingService";

const router: IRouter = Router();

router.post("/upload-intents", requirePermission("media.upload"), (req, res, next) => {
  try {
    res.status(201).json(createMediaUploadIntent(req.body, req.adminAuthz!.userId));
  } catch (e) {
    next(e);
  }
});

router.get("/jobs/:id", requirePermission("media.validate"), (req, res, next) => {
  try {
    res.json(getMediaJob(String(req.params.id)));
  } catch (e) {
    next(e);
  }
});

router.post("/jobs/:id/run", requirePermission("media.validate"), (req, res, next) => {
  try {
    res.json(runMediaJob(String(req.params.id)));
  } catch (e) {
    next(e);
  }
});

router.post("/validate", requirePermission("media.validate"), (req, res, next) => {
  try {
    res.json(validateMediaPayload(req.body || {}));
  } catch (e) {
    next(e);
  }
});

export default router;
