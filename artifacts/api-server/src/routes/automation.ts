import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/requireAdmin";
import {
  readAutomationConfig,
  resolveAutomationConfig,
  writeAutomationConfig,
} from "../../../../scripts/lib/automation-config.mjs";

const router: IRouter = Router();

type AutomationConfig = ReturnType<typeof readAutomationConfig>;

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
