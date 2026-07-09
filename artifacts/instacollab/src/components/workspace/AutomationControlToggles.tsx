import { useCallback, useEffect, useState } from 'react';
import { Brain, GitBranch, Plane, Rocket, Loader2 } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import {
  automationFromSettings,
  fetchAutomationConfig,
  patchAutomationConfig,
  resolveAutomationConfig,
  settingsPatchFromAutomation,
  settingsEqual,
  type AutomationConfig,
} from '../../lib/automationControls';

type ToggleKey = keyof AutomationConfig;

const MASTER_TOGGLE: {
  key: 'autopilot';
  label: string;
  title: string;
} = {
  key: 'autopilot',
  label: 'Autopilot',
  title: 'Full autopilot — auto deploy, push, ML fixes, and live cloud sync',
};

const TOGGLES: Array<{
  key: Exclude<ToggleKey, 'autopilot' | 'liveCloudSyncAggressive'>;
  label: string;
  title: string;
  icon: typeof Brain;
}> = [
  {
    key: 'autoMachineLearning',
    label: 'Auto ML',
    title: 'Auto machine learning — UX learning & Gemini fixes',
    icon: Brain,
  },
  {
    key: 'enabled',
    label: 'Auto Deploy',
    title: 'Auto deploy to production on save (live-sync / CI)',
    icon: Rocket,
  },
  {
    key: 'autoPush',
    label: 'Auto Push',
    title: 'Git commit & push before deploy',
    icon: GitBranch,
  },
];

export function AutomationControlToggles() {
  const db = useDB();
  const { showToast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [config, setConfig] = useState<AutomationConfig>(() =>
    automationFromSettings(db.settings),
  );

  useEffect(() => {
    setConfig(automationFromSettings(db.settings));
  }, [
    db.settings.autopilotEnabled,
    db.settings.autoDeployEnabled,
    db.settings.autoPushEnabled,
    db.settings.autoMachineLearning,
    db.settings.githubActionsDeploy,
  ]);

  useEffect(() => {
    let cancelled = false;
    void fetchAutomationConfig().then((remote) => {
      if (cancelled) return;
      const resolved = resolveAutomationConfig(remote);
      setConfig(resolved);
      const patch = settingsPatchFromAutomation(resolved);
      if (!settingsEqual(db.settings, patch)) {
        db.updateSettings(patch);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const toggle = useCallback(
    async (key: ToggleKey) => {
      const nextValue = !config[key];
      const optimistic = resolveAutomationConfig({ ...config, [key]: nextValue });
      setConfig(optimistic);
      db.updateSettings(settingsPatchFromAutomation(optimistic));
      setSyncing(true);
      try {
        const saved = await patchAutomationConfig({ [key]: nextValue });
        const resolved = resolveAutomationConfig(saved);
        setConfig(resolved);
        db.updateSettings(settingsPatchFromAutomation(resolved));
        window.dispatchEvent(
          new CustomEvent('automation:changed', { detail: resolved }),
        );
        const label =
          key === 'autopilot'
            ? MASTER_TOGGLE.label
            : TOGGLES.find((t) => t.key === key)?.label ?? key;
        showToast(`${label} ${nextValue ? 'on' : 'off'}`);
      } catch {
        showToast('Saved locally — server sync unavailable');
      } finally {
        setSyncing(false);
      }
    },
    [config, db, showToast],
  );

  const autopilotOn = config.autopilot;

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <button
        type="button"
        title={MASTER_TOGGLE.title}
        disabled={syncing}
        onClick={() => void toggle('autopilot')}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-sm font-black transition-all min-h-[44px] w-full sm:w-auto ${
          autopilotOn
            ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25'
            : 'border-border bg-secondary/50 text-foreground hover:bg-secondary'
        }`}
        aria-pressed={autopilotOn}
      >
        {syncing ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          <Plane className={`w-4 h-4 shrink-0 ${autopilotOn ? 'rotate-[-12deg]' : ''}`} />
        )}
        {MASTER_TOGGLE.label}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
            autopilotOn ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          {autopilotOn ? 'Flying' : 'Off'}
        </span>
      </button>

      <div className="flex flex-wrap items-center gap-2 justify-end">
        {TOGGLES.map(({ key, label, title, icon: Icon }) => {
          const on = config[key];
          return (
            <button
              key={key}
              type="button"
              title={autopilotOn ? `${title} (managed by Autopilot)` : title}
              disabled={syncing || autopilotOn}
              onClick={() => void toggle(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-bold transition-all min-h-[40px] ${
                on
                  ? 'border-primary/50 bg-primary/15 text-primary shadow-sm'
                  : 'border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
              } ${autopilotOn ? 'opacity-80' : ''}`}
              aria-pressed={on}
            >
              {syncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <Icon className="w-3.5 h-3.5 shrink-0" />
              )}
              {label}
              <span
                className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                  on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {on ? 'On' : 'Off'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
