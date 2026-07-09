import type { AppSettings } from './dbTypes';
import {
  fetchAutomationConfig as fetchAutomationConfigApi,
  isPlatformApiAvailable,
  patchAutomationConfig as patchAutomationConfigApi,
  type AutomationConfig,
} from './platformApi';

export type { AutomationConfig };

const DEFAULTS: AutomationConfig = {
  autopilot: false,
  enabled: false,
  autoPush: false,
  githubActionsDeploy: false,
  autoMachineLearning: false,
  liveCloudSyncAggressive: true,
};

export function settingsEqual(settings: AppSettings, patch: Partial<AppSettings>): boolean {
  for (const [key, value] of Object.entries(patch) as Array<[keyof AppSettings, AppSettings[keyof AppSettings]]>) {
    if (settings[key] !== value) return false;
  }
  return true;
}

/** Autopilot turns on every automation lane. */
export function resolveAutomationConfig(config: AutomationConfig): AutomationConfig {
  if (!config.autopilot) return { ...DEFAULTS, ...config };
  return {
    ...config,
    autopilot: true,
    enabled: true,
    autoPush: true,
    githubActionsDeploy: true,
    autoMachineLearning: true,
    liveCloudSyncAggressive: true,
  };
}

export function automationFromSettings(settings: AppSettings): AutomationConfig {
  return resolveAutomationConfig({
    autopilot: settings.autopilotEnabled === true,
    enabled: settings.autoDeployEnabled === true,
    autoPush: settings.autoPushEnabled === true,
    githubActionsDeploy: settings.githubActionsDeploy === true,
    autoMachineLearning: settings.autoMachineLearning === true,
    liveCloudSyncAggressive: true,
  });
}

export function settingsPatchFromAutomation(
  config: Partial<AutomationConfig>,
): Partial<AppSettings> {
  const resolved = resolveAutomationConfig({ ...DEFAULTS, ...config });
  const patch: Partial<AppSettings> = {};
  if (config.autopilot !== undefined) patch.autopilotEnabled = resolved.autopilot;
  if (config.enabled !== undefined || config.autopilot !== undefined) {
    patch.autoDeployEnabled = resolved.enabled;
  }
  if (config.autoPush !== undefined || config.autopilot !== undefined) {
    patch.autoPushEnabled = resolved.autoPush;
  }
  if (config.githubActionsDeploy !== undefined || config.autopilot !== undefined) {
    patch.githubActionsDeploy = resolved.githubActionsDeploy;
  }
  if (config.autoMachineLearning !== undefined || config.autopilot !== undefined) {
    patch.autoMachineLearning = resolved.autoMachineLearning;
  }
  return patch;
}

export function isAutopilotActive(settings: AppSettings = {} as AppSettings): boolean {
  const config = automationFromSettings(settings);
  return config.autopilot === true;
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
    return resolveAutomationConfig({ ...DEFAULTS, ...data });
  } catch {
    return DEFAULTS;
  }
}

export async function patchAutomationConfig(
  update: Partial<AutomationConfig>,
): Promise<AutomationConfig> {
  const optimistic = resolveAutomationConfig({ ...DEFAULTS, ...update });
  if (!canReachAutomationApi()) return optimistic;
  try {
    const data = await patchAutomationConfigApi(update);
    return resolveAutomationConfig({ ...DEFAULTS, ...data });
  } catch {
    return optimistic;
  }
}

/** @deprecated Use fetchAutomationConfig — kept for callers that gate on Supabase. */
export { isPlatformApiAvailable };
