import { Router, type IRouter } from "express";
import { auth } from "../../middlewares/auth";
import { requireNotBanned } from "../../middlewares/requireNotBanned";
import { loadAdminAuthz } from "../../middlewares/requirePermission";
import { detectAdminEnvironment } from "../../domain/admin-control-plane/adminIdentityService";
import { apiError } from "../../lib/apiError";
import { controlPlaneRateLimit, handleControlPlaneError } from "./helpers";
import changeSetsRouter from "./changeSets";
import uiCatalogRouter from "./uiCatalog";
import assetsRouter from "./assets";
import runtimeConfigRouter from "./runtimeConfig";
import sessionsRouter from "./sessions";
import auditRouter from "./audit";
import publishJobsRouter from "./publishJobs";
import accessCatalogRouter from "./accessCatalog";
import accessControlRouter from "./accessControl";
import giftsRouter from "./gifts";
import faceEffectsRouter from "./faceEffects";
import animationsRouter from "./animations";
import mediaPipelineRouter from "./mediaPipeline";
import performanceRouter from "./performance";
import rolloutsRouter from "./rollouts";
import liveUiRouter from "./liveUi";
import devHandoffRouter from "./devHandoff";
import designAgentRouter from "./designAgent";
import devAgentRouter from "./devAgent";
import workspaceConfigRouter from "./workspaceConfig";

const router: IRouter = Router();

/** Localhost dev only — auto admin sign-in handoff (no manual token paste). */
router.use("/dev/handoff", devHandoffRouter);

const gate = [auth, requireNotBanned, loadAdminAuthz, controlPlaneRateLimit];

router.get("/me", ...gate, (req, res) => {
  const ctx = req.adminAuthz!;
  if (!ctx.roles.length) {
    apiError(res, 403, "error.forbidden");
    return;
  }
  res.json({
    userId: ctx.userId,
    roles: ctx.roles,
    permissions: [...ctx.permissions],
    environment: ctx.environment,
    runtimeEnvironment: detectAdminEnvironment(),
    brand: "UniLive’s",
  });
});

router.get("/permissions", ...gate, (req, res) => {
  const ctx = req.adminAuthz!;
  if (!ctx.roles.length) {
    apiError(res, 403, "error.forbidden");
    return;
  }
  res.json({ permissions: [...ctx.permissions], roles: ctx.roles, environment: ctx.environment });
});

router.use("/change-sets", ...gate, changeSetsRouter);
router.use("/ui", ...gate, uiCatalogRouter);
router.use("/assets", ...gate, assetsRouter);
router.use("/feature-flags", ...gate, runtimeConfigRouter);
router.use("/secret-references", ...gate, runtimeConfigRouter);
router.use("/session-assignments", ...gate, sessionsRouter);
router.use("/audit", ...gate, auditRouter);
router.use("/access", ...gate, accessCatalogRouter);
router.use("/access", ...gate, accessControlRouter);
router.use("/access", ...gate, performanceRouter);
router.use("/access", ...gate, rolloutsRouter);
router.use("/gifts", ...gate, giftsRouter);
router.use("/face-effects", ...gate, faceEffectsRouter);
router.use("/animations", ...gate, animationsRouter);
router.use("/media", ...gate, mediaPipelineRouter);
router.use("/live-ui", ...gate, liveUiRouter);
router.use("/design-agent", ...gate, designAgentRouter);
router.use("/dev-agent", ...gate, devAgentRouter);
router.use("/workspace-config", ...gate, workspaceConfigRouter);
router.use("/publish-jobs", ...gate, publishJobsRouter);

router.use(handleControlPlaneError);

export default router;
