import type { AppSettings } from './dbTypes';
import {
  fetchAutomationConfig as fetchAutomationConfigApi,
  patchAutomationConfig as patchAutomationConfigApi,
  type AutomationConfig,
} from './platformApi';

export type { AutomationConfig };

const DEFAULTS: AutomationConfig = {
  enabled: false,
  autoPush: false,
  githubActionsDeploy: false,
  autoMachineLearning: false,
};

export function automationFromSettings(settings: AppSettings): AutomationConfig {
  return {
    enabled: settings.autoDeployEnabled === true,
    autoPush: settings.autoPushEnabled === true,
    githubActionsDeploy: settings.githubActionsDeploy === true,
    autoMachineLearning: settings.autoMachineLearning === true,
  };
}

export function settingsPatchFromAutomation(
  config: Partial<AutomationConfig>,
): Partial<AppSettings> {
  const patch: Partial<AppSettings> = {};
  if (config.enabled !== undefined) patch.autoDeployEnabled = config.enabled;
  if (config.autoPush !== undefined) patch.autoPushEnabled = config.autoPush;
  if (config.githubActionsDeploy !== undefined) {
    patch.githubActionsDeploy = config.githubActionsDeploy;
  }
  if (config.autoMachineLearning !== undefined) {
    patch.autoMachineLearning = config.autoMachineLearning;
  }
  return patch;
}

/** Same-origin /api/* works on app host even when Supabase auth is unreachable. */
function canReachAutomationApi(): boolean {
  if (typeof window === 'undefined') return false;
  return true;
}

export async function fetchAutomationConfig(): Promise<AutomationConfig> {
  if (!canReachAutomationApi()) return DEFAULTS;
  try {
    const data = await fetchAutomationConfigApi();
    return { ...DEFAULTS, ...data };
  } catch {
    return DEFAULTS;
  }
}

export async function patchAutomationConfig(
  update: Partial<AutomationConfig>,
): Promise<AutomationConfig> {
  const optimistic = { ...DEFAULTS, ...update };
  if (!canReachAutomationApi()) return optimistic;
  try {
    const data = await patchAutomationConfigApi(update);
    return { ...DEFAULTS, ...data };
  } catch {
    return optimistic;
  }
}
