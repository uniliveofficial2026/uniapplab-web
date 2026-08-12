/**
 * Automation config for the API server (bundled — do not require scripts/ at runtime).
 * Reads/writes config/auto-deploy.json when the filesystem allows; otherwise defaults.
 */
import fs from "node:fs";
import path from "node:path";

export type AutomationConfig = {
  autopilot?: boolean;
  enabled?: boolean;
  autoPush?: boolean;
  githubActionsDeploy?: boolean;
  autoMachineLearning?: boolean;
  liveCloudSyncAggressive?: boolean;
  note?: string;
};

const DEFAULTS: Required<
  Omit<AutomationConfig, "note">
> & { note?: string } = {
  autopilot: false,
  enabled: false,
  autoPush: false,
  githubActionsDeploy: false,
  autoMachineLearning: false,
  liveCloudSyncAggressive: true,
};

function configPath(): string {
  const candidates = [
    path.join(process.cwd(), "config", "auto-deploy.json"),
    path.join(process.cwd(), "..", "..", "config", "auto-deploy.json"),
    path.join(process.cwd(), "..", "config", "auto-deploy.json"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

export function readAutomationConfig(): AutomationConfig {
  try {
    const file = configPath();
    if (!fs.existsSync(file)) return { ...DEFAULTS };
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    return {
      autopilot: raw.autopilot === true,
      enabled: raw.enabled === true,
      autoPush: raw.autoPush === true,
      githubActionsDeploy: raw.githubActionsDeploy === true,
      autoMachineLearning: raw.autoMachineLearning === true,
      liveCloudSyncAggressive: raw.liveCloudSyncAggressive !== false,
      note: typeof raw.note === "string" ? raw.note : undefined,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Autopilot turns on every automation lane. */
export function resolveAutomationConfig(
  raw: AutomationConfig = readAutomationConfig(),
): AutomationConfig {
  if (!raw.autopilot) return raw;
  return {
    ...raw,
    autopilot: true,
    enabled: true,
    autoPush: true,
    githubActionsDeploy: true,
    autoMachineLearning: true,
    liveCloudSyncAggressive: true,
  };
}

export function writeAutomationConfig(update: Partial<AutomationConfig>): AutomationConfig {
  const current = readAutomationConfig();
  const next: AutomationConfig = { ...current, ...update };
  if (update.autopilot === true) {
    next.autopilot = true;
    next.enabled = true;
    next.autoPush = true;
    next.githubActionsDeploy = true;
    next.autoMachineLearning = true;
    next.liveCloudSyncAggressive = true;
  }
  const file = configPath();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  } catch {
    /* Vercel serverless FS is read-only — return in-memory config */
  }
  return next;
}
