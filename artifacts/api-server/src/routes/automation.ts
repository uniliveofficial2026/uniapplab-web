import { createRequire } from "node:module";
import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/requireAdmin";

const require = createRequire(import.meta.url);
const {
  readAutomationConfig,
  resolveAutomationConfig,
  writeAutomationConfig,
} = require("../../../../scripts/lib/automation-config.mjs") as {
  readAutomationConfig: () => AutomationConfig;
  resolveAutomationConfig: (config: AutomationConfig) => AutomationConfig;
  writeAutomationConfig: (patch: Partial<AutomationConfig>) => AutomationConfig;
};

const router: IRouter = Router();

type AutomationConfig = {
  autopilot?: boolean;
  enabled?: boolean;
  autoPush?: boolean;
  githubActionsDeploy?: boolean;
  autoMachineLearning?: boolean;
  liveCloudSyncAggressive?: boolean;
};

router.get("/automation", (_req, res) => {
  res.json(resolveAutomationConfig(readAutomationConfig()));
});

router.patch("/automation", auth, requireAdmin, (req, res) => {
  const body = req.body as Partial<AutomationConfig>;
  const patch: Partial<AutomationConfig> = {};

  if (typeof body.autopilot === "boolean") patch.autopilot = body.autopilot;
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.autoPush === "boolean") patch.autoPush = body.autoPush;
  if (typeof body.githubActionsDeploy === "boolean") {
    patch.githubActionsDeploy = body.githubActionsDeploy;
  }
  if (typeof body.autoMachineLearning === "boolean") {
    patch.autoMachineLearning = body.autoMachineLearning;
  }
  if (typeof body.liveCloudSyncAggressive === "boolean") {
    patch.liveCloudSyncAggressive = body.liveCloudSyncAggressive;
  }

  if (!Object.keys(patch).length) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  res.json(resolveAutomationConfig(writeAutomationConfig(patch)));
});

export default router;
