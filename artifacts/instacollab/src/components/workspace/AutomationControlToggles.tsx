import { useCallback, useEffect, useState } from 'react';
import { Brain, GitBranch, Rocket, Loader2 } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import {
  automationFromSettings,
  fetchAutomationConfig,
  patchAutomationConfig,
  settingsPatchFromAutomation,
  type AutomationConfig,
} from '../../lib/automationControls';

type ToggleKey = keyof AutomationConfig;

const TOGGLES: Array<{
  key: ToggleKey;
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
    db.settings.autoDeployEnabled,
    db.settings.autoPushEnabled,
    db.settings.autoMachineLearning,
    db.settings.githubActionsDeploy,
  ]);

  useEffect(() => {
    let cancelled = false;
    void fetchAutomationConfig().then((remote) => {
      if (cancelled) return;
      setConfig((prev) => ({ ...prev, ...remote }));
      db.updateSettings(settingsPatchFromAutomation(remote));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once on mount
  }, []);

  const toggle = useCallback(
    async (key: ToggleKey) => {
      const nextValue = !config[key];
      const optimistic = { ...config, [key]: nextValue };
      setConfig(optimistic);
      db.updateSettings(settingsPatchFromAutomation({ [key]: nextValue }));
      setSyncing(true);
      try {
        const saved = await patchAutomationConfig({ [key]: nextValue });
        setConfig(saved);
        db.updateSettings(settingsPatchFromAutomation(saved));
        window.dispatchEvent(
          new CustomEvent('automation:changed', { detail: saved }),
        );
        const label = TOGGLES.find((t) => t.key === key)?.label ?? key;
        showToast(`${label} ${nextValue ? 'on' : 'off'}`);
      } catch {
        showToast('Saved locally — server sync unavailable');
      } finally {
        setSyncing(false);
      }
    },
    [config, db, showToast],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {TOGGLES.map(({ key, label, title, icon: Icon }) => {
        const on = config[key];
        return (
          <button
            key={key}
            type="button"
            title={title}
            disabled={syncing}
            onClick={() => void toggle(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-bold transition-all min-h-[40px] ${
              on
                ? 'border-primary/50 bg-primary/15 text-primary shadow-sm'
                : 'border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
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
  );
}
