/**
 * Autopilot — sync server automation config into the app on boot and keep it live.
 */
import {
  automationFromSettings,
  fetchAutomationConfig,
  resolveAutomationConfig,
  settingsPatchFromAutomation,
  settingsEqual,
  type AutomationConfig,
} from './automationControls';
import { db } from './db/localDb';

const SYNC_INTERVAL_MS = 5 * 60_000;

function applyAutomationConfig(config: AutomationConfig): void {
  const resolved = resolveAutomationConfig(config);
  const patch = settingsPatchFromAutomation(resolved);
  if (!settingsEqual(db.settings, patch)) {
    db.updateSettings(patch);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.autopilot = resolved.autopilot ? '1' : '0';
  }
}

export function isAutopilotActive(): boolean {
  return automationFromSettings(db.settings).autopilot === true;
}

export function initAppAutopilot(): void {
  if (typeof window === 'undefined') return;

  const onConfig = (config: AutomationConfig) => {
    applyAutomationConfig(config);
  };

  void fetchAutomationConfig().then(onConfig);

  window.addEventListener('automation:changed', (event) => {
    const detail = (event as CustomEvent<AutomationConfig>).detail;
    if (detail) onConfig(detail);
  });

  window.setInterval(() => {
    if (!navigator.onLine) return;
    void fetchAutomationConfig().then(onConfig);
  }, SYNC_INTERVAL_MS);

  window.addEventListener('online', () => {
    void fetchAutomationConfig().then(onConfig);
  });
}
