import { Router, type IRouter } from "express";
import { requirePermission } from "../../middlewares/requirePermission";
import {
  listActions,
  listBindings,
  listComponents,
  listElements,
  listExperiences,
  listLayouts,
  listTranslations,
} from "../../domain/admin-control-plane/uiCatalogReadService";
import {
  browseUiCloneCatalog,
  getUiCloneDetail,
  listUiCloneDomains,
  listUiCloneTypes,
} from "../../domain/admin-control-plane/uiCloneCatalogService";

const router: IRouter = Router();

router.get("/experiences", requirePermission("ui.experience.read"), (_req, res) => {
  res.json({ items: listExperiences() });
});
router.get("/nodes", requirePermission("ui.experience.read"), (_req, res) => {
  res.json({ items: listExperiences().map((e) => ({ experienceKey: e.key, note: "nodes live in existing ui-catalog experience folders" })) });
});
router.get("/components", requirePermission("ui.experience.read"), (_req, res) => {
  res.json({ items: listComponents() });
});
router.get("/elements", requirePermission("ui.experience.read"), (_req, res) => {
  res.json({ items: listElements() });
});
router.get("/layouts", requirePermission("ui.experience.read"), (_req, res) => {
  res.json({ items: listLayouts() });
});
router.get("/actions", requirePermission("ui.experience.read"), (_req, res) => {
  res.json({ items: listActions() });
});
router.get("/bindings", requirePermission("ui.experience.read"), (_req, res) => {
  res.json({ items: listBindings() });
});
router.get("/translations", requirePermission("translation.read"), (_req, res) => {
  res.json({ items: listTranslations() });
});
router.get("/assets", requirePermission("asset.read"), (_req, res) => {
  res.json({ items: [], note: "asset versions live in existing ui-catalog / unilives-assets" });
});

router.get("/clone-catalog/types", requirePermission("ui.experience.read"), (_req, res) => {
  res.json({ items: listUiCloneTypes() });
});

router.get("/clone-catalog/domains", requirePermission("ui.experience.read"), (_req, res) => {
  res.json({ items: listUiCloneDomains() });
});

router.get("/clone-catalog", requirePermission("ui.experience.read"), (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const domain = typeof req.query.domain === "string" ? req.query.domain : undefined;
    const limit = Number(req.query.limit || 60);
    const offset = Number(req.query.offset || 0);
    res.json(browseUiCloneCatalog({ q, type, domain, limit, offset }));
  } catch (e) {
    next(e);
  }
});

router.get("/clone-catalog/:resourceId", requirePermission("ui.experience.read"), (req, res, next) => {
  try {
    res.json(getUiCloneDetail(String(req.params.resourceId)));
  } catch (e) {
    next(e);
  }
});

export default router;
