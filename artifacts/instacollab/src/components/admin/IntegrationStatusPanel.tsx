import React, { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Copy, Pencil, Plus, RefreshCw, Save, Trash2, Wand2, X } from 'lucide-react';
import {
  autoFillIntegrationEnvFromRuntime,
  buildEnvTemplate,
  getIntegrationServiceStatus,
  type IntegrationServiceDef,
} from '../../lib/adminIntegrations';
import {
  createEmptyCustomIntegration,
  deleteCustomIntegration,
  getAllIntegrationServices,
  isBuiltinIntegration,
  resetIntegrationOverride,
  upsertCustomIntegration,
  upsertIntegrationOverride,
} from '../../lib/adminIntegrationStore';
import { getIntegrationEnvOverrides, saveIntegrationEnv } from '../../lib/integrationEnv';
import { useDB, useDbRevision } from '../../lib/useDB';

function ServiceCard({
  service,
  onEditKey,
  onEdit,
  onDelete,
  onReset,
}: {
  service: IntegrationServiceDef;
  onEditKey: (key: string) => void;
  onEdit: () => void;
  onDelete?: () => void;
  onReset?: () => void;
}) {
  const status = getIntegrationServiceStatus(service);
  const custom = !isBuiltinIntegration(service.id);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-sm flex items-center gap-2">
            {service.name}
            {custom ? (
              <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">Custom</span>
            ) : null}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{service.description}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-full shrink-0 ${
            status.healthy
              ? 'bg-emerald-500/10 text-emerald-600'
              : status.configured
                ? 'bg-amber-500/10 text-amber-700'
                : 'bg-secondary text-muted-foreground'
          }`}
        >
          {status.healthy ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
          {status.healthy ? 'Ready' : status.configured ? 'Partial' : 'Missing'}
        </span>
      </div>

      {status.note ? <p className="text-[11px] text-amber-600">{status.note}</p> : null}

      <div className="space-y-1">
        <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Env keys</div>
        <div className="flex flex-wrap gap-1.5">
          {service.envKeys.map((key) => {
            const missing = status.missingKeys.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onEditKey(key)}
                className={`text-[10px] font-mono px-2 py-1 rounded-lg border ${
                  missing ? 'border-destructive/30 text-destructive bg-destructive/5' : 'border-emerald-500/20 text-emerald-700 bg-emerald-500/5'
                }`}
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>

      <details className="text-[11px]">
        <summary className="cursor-pointer font-bold text-muted-foreground">SDK · packages · files</summary>
        <div className="mt-2 space-y-2 text-muted-foreground">
          <div>
            <span className="font-bold text-foreground">Packages:</span> {service.packages.length ? service.packages.join(', ') : '—'}
          </div>
          <div>
            <span className="font-bold text-foreground">Files:</span>
            <ul className="list-disc pl-4 mt-1">
              {(service.files.length ? service.files : ['—']).map((f) => (
                <li key={f} className="font-mono text-[10px] break-all">
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="font-bold text-foreground">Scripts:</span>{' '}
            {service.scripts.length ? (
              service.scripts.map((s) => (
                <code key={s} className="mr-2 text-[10px] bg-secondary px-1 rounded">
                  pnpm {s}
                </code>
              ))
            ) : (
              '—'
            )}
          </div>
        </div>
      </details>

      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-border min-h-[36px]">
          <Pencil className="w-3 h-3" /> Edit
        </button>
        {onReset ? (
          <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-border min-h-[36px]">
            Reset defaults
          </button>
        ) : null}
        {onDelete ? (
          <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-destructive/30 text-destructive min-h-[36px]">
            <Trash2 className="w-3 h-3" /> Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}

function IntegrationEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  isBuiltin,
}: {
  draft: IntegrationServiceDef;
  onChange: (next: IntegrationServiceDef) => void;
  onSave: () => void;
  onCancel: () => void;
  isBuiltin: boolean;
}) {
  const updateListField = (field: 'envKeys' | 'packages' | 'files' | 'scripts', raw: string) => {
    const values = raw
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);
    onChange({ ...draft, [field]: values });
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-sm">{isBuiltin ? `Edit ${draft.name}` : 'Add / edit integration'}</h3>
        <button type="button" onClick={onCancel} className="p-2 rounded-lg border border-border min-h-[36px] min-w-[36px] flex items-center justify-center">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs sm:col-span-2">
          <span className="font-bold text-muted-foreground">Name</span>
          <input
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background min-h-[40px]"
          />
        </label>
        {!isBuiltin ? (
          <label className="block text-xs sm:col-span-2">
            <span className="font-bold text-muted-foreground">ID</span>
            <input
              value={draft.id}
              onChange={(e) => onChange({ ...draft, id: e.target.value.trim() })}
              className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background font-mono text-[11px] min-h-[40px]"
            />
          </label>
        ) : null}
        <label className="block text-xs sm:col-span-2">
          <span className="font-bold text-muted-foreground">Description</span>
          <input
            value={draft.description}
            onChange={(e) => onChange({ ...draft, description: e.target.value })}
            className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background min-h-[40px]"
          />
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className="font-bold text-muted-foreground">Env keys (comma or newline)</span>
          <textarea
            value={draft.envKeys.join('\n')}
            onChange={(e) => updateListField('envKeys', e.target.value)}
            rows={3}
            className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background font-mono text-[11px]"
            placeholder="VITE_MY_API_KEY"
          />
        </label>
        <label className="block text-xs">
          <span className="font-bold text-muted-foreground">Packages</span>
          <textarea
            value={draft.packages.join('\n')}
            onChange={(e) => updateListField('packages', e.target.value)}
            rows={3}
            className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background font-mono text-[11px]"
          />
        </label>
        <label className="block text-xs">
          <span className="font-bold text-muted-foreground">Scripts</span>
          <textarea
            value={draft.scripts.join('\n')}
            onChange={(e) => updateListField('scripts', e.target.value)}
            rows={3}
            className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background font-mono text-[11px]"
          />
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className="font-bold text-muted-foreground">Files / code paths</span>
          <textarea
            value={draft.files.join('\n')}
            onChange={(e) => updateListField('files', e.target.value)}
            rows={3}
            className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background font-mono text-[11px]"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onSave} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl bg-primary text-primary-foreground min-h-[40px]">
          <Save className="w-3.5 h-3.5" /> Save integration
        </button>
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl border border-border min-h-[40px]">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function IntegrationStatusPanel() {
  const db = useDB();
  useDbRevision();
  const [envDraft, setEnvDraft] = useState<Record<string, string>>(() => getIntegrationEnvOverrides());
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [editorDraft, setEditorDraft] = useState<IntegrationServiceDef | null>(null);
  const [catalogTick, setCatalogTick] = useState(0);

  const services = useMemo(() => {
    void catalogTick;
    return getAllIntegrationServices();
  }, [catalogTick]);

  const allKeys = useMemo(() => [...new Set(services.flatMap((service) => service.envKeys))], [services]);

  const refreshCatalog = () => setCatalogTick((value) => value + 1);

  const refreshFromDb = useCallback(() => {
    setEnvDraft(getIntegrationEnvOverrides());
    refreshCatalog();
  }, []);

  const handleAutoConfig = () => {
    const next = autoFillIntegrationEnvFromRuntime(services);
    setEnvDraft(next);
    saveIntegrationEnv(next);
    setSavedAt(Date.now());
  };

  const handleSave = () => {
    saveIntegrationEnv(envDraft);
    setSavedAt(Date.now());
    db.addAuditLog?.({ id: Date.now(), text: 'Integration env overrides saved', time: 'Just now' });
  };

  const copyTemplate = async () => {
    await navigator.clipboard.writeText(buildEnvTemplate(services));
  };

  const saveIntegrationDraft = () => {
    if (!editorDraft) return;
    const trimmedId = editorDraft.id.trim();
    if (!trimmedId || !editorDraft.name.trim()) return;

    const row: IntegrationServiceDef = {
      ...editorDraft,
      id: trimmedId,
      name: editorDraft.name.trim(),
      description: editorDraft.description.trim(),
      envKeys: editorDraft.envKeys.filter(Boolean),
    };

    if (isBuiltinIntegration(row.id)) {
      upsertIntegrationOverride(row.id, {
        name: row.name,
        description: row.description,
        envKeys: row.envKeys,
        packages: row.packages,
        files: row.files,
        scripts: row.scripts,
      });
    } else {
      upsertCustomIntegration(row);
    }

    setEditorDraft(null);
    refreshCatalog();
    window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Integration saved' }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEditorDraft(createEmptyCustomIntegration())}
          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-border min-h-[40px]"
        >
          <Plus className="w-3.5 h-3.5" /> Add integration
        </button>
        <button
          type="button"
          onClick={handleAutoConfig}
          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-primary text-primary-foreground min-h-[40px]"
        >
          <Wand2 className="w-3.5 h-3.5" /> Auto-config from runtime
        </button>
        <button type="button" onClick={copyTemplate} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-border min-h-[40px]">
          <Copy className="w-3.5 h-3.5" /> Copy .env template
        </button>
        <button type="button" onClick={refreshFromDb} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-border min-h-[40px]">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
        <button type="button" onClick={handleSave} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-border min-h-[40px]">
          <Save className="w-3.5 h-3.5" /> Save overrides
        </button>
        {savedAt ? (
          <span className="text-[11px] text-muted-foreground self-center">Saved {new Date(savedAt).toLocaleTimeString()}</span>
        ) : null}
      </div>

      {editorDraft ? (
        <IntegrationEditor
          draft={editorDraft}
          onChange={setEditorDraft}
          onSave={saveIntegrationDraft}
          onCancel={() => setEditorDraft(null)}
          isBuiltin={isBuiltinIntegration(editorDraft.id)}
        />
      ) : null}

      <div className="rounded-2xl border border-border bg-secondary/10 p-4 space-y-3">
        <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Runtime env overrides (admin)</div>
        <p className="text-xs text-muted-foreground">
          Values saved here apply at runtime for LiveKit, TRTC, custom integrations, and other SDKs without rebuilding. Production deploys should still use{' '}
          <code className="text-[10px]">artifacts/instacollab/.env</code> or Vercel env.
        </p>
        <div className="grid grid-cols-1 gap-2 max-h-[240px] overflow-y-auto">
          {allKeys.map((key) => (
            <label key={key} className={`block ${activeKey === key ? 'ring-2 ring-primary rounded-xl' : ''}`}>
              <span className="text-[10px] font-mono text-muted-foreground">{key}</span>
              <input
                value={envDraft[key] ?? ''}
                onChange={(e) => setEnvDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                onFocus={() => setActiveKey(key)}
                className="mt-1 w-full text-xs font-mono border border-border rounded-lg px-3 py-2 bg-background min-h-[40px]"
                placeholder="Paste value…"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            onEditKey={setActiveKey}
            onEdit={() => setEditorDraft({ ...service })}
            onDelete={
              !isBuiltinIntegration(service.id)
                ? () => {
                    deleteCustomIntegration(service.id);
                    refreshCatalog();
                  }
                : undefined
            }
            onReset={
              isBuiltinIntegration(service.id)
                ? () => {
                    resetIntegrationOverride(service.id);
                    refreshCatalog();
                  }
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
