import { Router, type IRouter } from "express";
import fs from "node:fs";
import path from "node:path";
import { auth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();
const workspaceRoot = path.resolve(import.meta.dirname, "../../../..");
const configPath = path.join(workspaceRoot, "config/auto-deploy.json");

type AutomationConfig = {
  enabled: boolean;
  autoPush: boolean;
  githubActionsDeploy: boolean;
  autoMachineLearning: boolean;
  note?: string;
};

const DEFAULTS: AutomationConfig = {
  enabled: false,
  autoPush: false,
  githubActionsDeploy: false,
  autoMachineLearning: false,
};

function readConfig(): AutomationConfig {
  try {
    if (!fs.existsSync(configPath)) return { ...DEFAULTS };
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8")) as Partial<AutomationConfig>;
    return {
      enabled: raw.enabled === true,
      autoPush: raw.autoPush === true,
      githubActionsDeploy: raw.githubActionsDeploy === true,
      autoMachineLearning: raw.autoMachineLearning === true,
      note: typeof raw.note === "string" ? raw.note : undefined,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeConfig(update: Partial<AutomationConfig>): AutomationConfig {
  const current = readConfig();
  const next: AutomationConfig = {
    ...current,
    ...update,
  };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

router.get("/automation", auth, requireAdmin, (_req, res) => {
  res.json(readConfig());
});

router.patch("/automation", (req, res) => {
  const apply = () => {
    const body = req.body as Partial<AutomationConfig>;
    const patch: Partial<AutomationConfig> = {};
    if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
    if (typeof body.autoPush === "boolean") patch.autoPush = body.autoPush;
    if (typeof body.githubActionsDeploy === "boolean") {
      patch.githubActionsDeploy = body.githubActionsDeploy;
    }
    if (typeof body.autoMachineLearning === "boolean") {
      patch.autoMachineLearning = body.autoMachineLearning;
    }
    if (!Object.keys(patch).length) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }
    res.json(writeConfig(patch));
  };

  if (process.env.NODE_ENV !== "production") {
    apply();
    return;
  }

  void auth(req, res, () => {
    void requireAdmin(req, res, apply);
  });
});

export default router;
