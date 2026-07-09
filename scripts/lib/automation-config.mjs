/**
 * Shared automation / autopilot config — scripts + API read the same file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'config/auto-deploy.json');

const DEFAULTS = {
  autopilot: false,
  enabled: false,
  autoPush: false,
  githubActionsDeploy: false,
  autoMachineLearning: false,
  liveCloudSyncAggressive: true,
};

export function readAutomationConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return { ...DEFAULTS };
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return {
      autopilot: raw.autopilot === true,
      enabled: raw.enabled === true,
      autoPush: raw.autoPush === true,
      githubActionsDeploy: raw.githubActionsDeploy === true,
      autoMachineLearning: raw.autoMachineLearning === true,
      liveCloudSyncAggressive: raw.liveCloudSyncAggressive !== false,
      note: typeof raw.note === 'string' ? raw.note : undefined,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Autopilot turns on every automation lane. */
export function resolveAutomationConfig(raw = readAutomationConfig()) {
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

export function isAutopilotOn() {
  return resolveAutomationConfig().autopilot === true;
}

export function writeAutomationConfig(update) {
  const current = readAutomationConfig();
  const next = { ...current, ...update };
  if (update.autopilot === true) {
    next.autopilot = true;
    next.enabled = true;
    next.autoPush = true;
    next.githubActionsDeploy = true;
    next.autoMachineLearning = true;
    next.liveCloudSyncAggressive = true;
  }
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}
