import { Router, type IRouter } from "express";
import { requirePermission } from "../../middlewares/requirePermission";
import {
  approveAsset,
  createUploadIntent,
  getAssetBytes,
  listAssets,
  uploadLocalAsset,
  validateAsset,
  assetHasContent,
} from "../../domain/admin-control-plane";
import { detectAdminEnvironment } from "../../domain/admin-control-plane/adminIdentityService";
import { apiError } from "../../lib/apiError";

const router: IRouter = Router();

function localDevOnly(_req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  if (detectAdminEnvironment() !== "local") {
    apiError(res, 404, "error.notFound");
    return;
  }
  next();
}

router.get("/", requirePermission("asset.read"), (_req, res) => {
  res.json({
    items: listAssets().map((row) => ({
      ...row,
      previewUrl: row.publicUrl,
      hasContent: assetHasContent(row.id),
    })),
  });
});

router.post("/upload-local", requirePermission("asset.upload"), localDevOnly, (req, res, next) => {
  try {
    const body = req.body as { assetId?: string; fileName?: string; mimeType?: string; dataBase64?: string };
    if (!body.assetId || !body.fileName || !body.mimeType || !body.dataBase64) {
      apiError(res, 400, "asset.invalid");
      return;
    }
    const row = uploadLocalAsset(
      {
        assetId: String(body.assetId),
        fileName: String(body.fileName),
        mimeType: String(body.mimeType),
        dataBase64: String(body.dataBase64),
      },
      req.adminAuthz!.userId,
    );
    res.status(201).json({
      id: row.id,
      assetId: row.assetId,
      status: row.status,
      publicUrl: row.publicUrl,
      previewUrl: row.publicUrl,
      fileName: row.fileName,
      mimeType: row.mimeType,
      byteSize: row.byteSize,
      hasContent: true,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/:id/content", requirePermission("asset.read"), localDevOnly, (req, res, next) => {
  try {
    const { row, bytes } = getAssetBytes(String(req.params.id));
    res.setHeader("content-type", row.mimeType);
    res.setHeader("cache-control", "private, max-age=3600");
    res.send(bytes);
  } catch (e) {
    next(e);
  }
});

router.post("/upload-intent", requirePermission("asset.upload"), (req, res, next) => {
  try {
    const rec = createUploadIntent(req.body, req.adminAuthz!.userId);
    res.status(201).json({
      id: rec.id,
      assetId: rec.assetId,
      status: rec.status,
      uploadKey: rec.id,
      publicUrl: null,
      note: "quarantined — not publicly accessible",
    });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/validate", requirePermission("asset.approve"), (req, res, next) => {
  try {
    res.json(validateAsset(String(req.params.id)));
  } catch (e) {
    next(e);
  }
});

router.post("/:id/approve", requirePermission("asset.approve"), (req, res, next) => {
  try {
    res.json(approveAsset(String(req.params.id)));
  } catch (e) {
    next(e);
  }
});

export default router;
