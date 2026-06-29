import React, { useEffect, useState } from 'react';
import type { ComposedDbLayers } from '../../lib/db/layers';
import type { DatingState } from '../../lib/db/domains/datingState';
import { useDatingExperimentAnalytics } from '../../lib/useDatingExperimentAnalytics';
import { EMPTY_EXPERIMENT_METRICS } from '../../lib/db/domains/datingExperimentUtils';
import { HorizontalScrollRail } from './HorizontalScrollRail';

type Props = {
  db: ComposedDbLayers;
  showToast: (message: string) => void;
};

type Stability = DatingState['experiment']['stability'];
type RankingTuning = DatingState['rankingTuning'];

export function DatingExperimentPanel({ db, showToast }: Props) {
  const [experimentWindowHours, setExperimentWindowHours] = useState<24 | 72 | 168>(24);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const { analytics, loading } = useDatingExperimentAnalytics(experimentWindowHours, true);

  const [stabilityDraft, setStabilityDraft] = useState<Stability>(() => db.datingState.experiment.stability);
  const [rankingDraft, setRankingDraft] = useState<RankingTuning>(() => db.datingState.rankingTuning);

  useEffect(() => {
    setStabilityDraft(db.datingState.experiment.stability);
    setRankingDraft(db.datingState.rankingTuning);
  }, [db.datingState.experiment.stability, db.datingState.rankingTuning]);

  const experimentSummary = analytics?.summary ?? EMPTY_EXPERIMENT_METRICS;
  const experimentWinner = analytics?.winner ?? {
    bucket: null,
    reason: loading ? 'Computing experiment analytics…' : 'Experiment analytics unavailable',
    score: 0,
    confidence: 0,
    status: 'insufficient_data' as const,
    minExposureRequired: 0,
    observedDelta: 0,
  };

  const commitStabilityDraft = () => {
    db.setDatingExperimentStability(stabilityDraft);
  };

  const commitRankingDraft = () => {
    db.setDatingRankingTuning(rankingDraft);
  };

  const downloadTextFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importExperimentFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result));
        const result = db.importDatingExperimentExport(payload, importMode);
        if (!result.ok) {
          showToast(`Import failed: ${result.message}`);
          return;
        }
        const schemaNote = result.schemaVersionUsed
          ? result.migratedFrom
            ? `schema v${result.schemaVersionUsed} migrated`
            : `schema v${result.schemaVersionUsed}`
          : 'schema unknown';
        showToast(`${result.message} (${result.importedEvents} events, ${schemaNote})`);
      } catch {
        showToast('Import failed: invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-sm font-black tracking-wide">Experiment Bucket</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={experimentWindowHours}
            onChange={(e) => setExperimentWindowHours(Number(e.target.value) as 24 | 72 | 168)}
            className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold"
          >
            <option value={24}>24h</option>
            <option value={72}>72h</option>
            <option value={168}>7d</option>
          </select>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
            {(['auto', 'A', 'B', 'C'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => db.setDatingExperimentMode(mode)}
                className={`rounded px-2 py-1 text-[11px] font-bold ${db.datingState.experiment.mode === mode ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary'}`}
              >
                {mode}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              db.resetDatingExperimentMetrics();
              showToast('Experiment metrics reset');
            }}
            className="rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-bold hover:bg-secondary"
          >
            Reset Metrics
          </button>
          <button
            type="button"
            onClick={() => {
              const payload = db.getDatingExperimentExport(experimentWindowHours);
              downloadTextFile(
                `dating-experiment-${payload.generatedAt}.json`,
                JSON.stringify(payload, null, 2),
                'application/json'
              );
              showToast('Exported experiment JSON');
            }}
            className="rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-bold hover:bg-secondary"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => {
              const csv = db.getDatingExperimentEventsCsv(experimentWindowHours);
              downloadTextFile(`dating-experiment-${Date.now()}.csv`, csv, 'text/csv;charset=utf-8');
              showToast('Exported experiment CSV');
            }}
            className="rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-bold hover:bg-secondary"
          >
            Export CSV
          </button>
          <select
            value={importMode}
            onChange={(e) => setImportMode(e.target.value as 'append' | 'replace')}
            className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold"
          >
            <option value="append">Import: Append</option>
            <option value="replace">Import: Replace</option>
          </select>
          <label className="cursor-pointer rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-bold hover:bg-secondary">
            Import JSON
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                importExperimentFile(e.target.files?.[0] ?? null);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {loading ? (
        <p className="mb-3 text-xs text-muted-foreground">Loading bucket analytics…</p>
      ) : null}

      <HorizontalScrollRail ariaLabel="Experiment buckets" scrollStep={240} className="mb-3">
        {(['A', 'B', 'C'] as const).map((bucket) => {
          const m = experimentSummary[bucket] ?? EMPTY_EXPERIMENT_METRICS[bucket];
          const ctr = m.exposures > 0 ? ((m.likes + m.matches) / m.exposures) * 100 : 0;
          const isActive = db.datingState.experiment.mode === bucket;
          return (
            <div
              key={bucket}
              className={`min-w-[200px] shrink-0 rounded-xl border p-2.5 text-xs ${
                isActive ? 'border-primary bg-primary/5' : 'border-border bg-background'
              }`}
            >
              <p className="font-black">Bucket {bucket}</p>
              <p className="text-muted-foreground">
                Exp {m.exposures} · Like {m.likes} · Pass {m.passes} · Match {m.matches}
              </p>
              <p className="mt-1 font-semibold">CTR {ctr.toFixed(1)}%</p>
            </div>
          );
        })}
      </HorizontalScrollRail>

      <div className="mb-3 rounded-xl border border-border bg-background p-2.5 text-xs">
        <p className="mb-2 font-black">Operator Guardrails</p>
        <p className="mb-2 text-[11px] text-muted-foreground">Drag sliders, release to save (avoids freezing while adjusting).</p>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {(
            [
              ['conservative', 'Conservative'],
              ['balanced', 'Balanced'],
              ['aggressive', 'Aggressive'],
            ] as const
          ).map(([preset, label]) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                db.applyDatingExperimentPreset(preset);
                showToast(`Applied ${label} preset`);
              }}
              className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-bold hover:bg-secondary"
            >
              {label}
            </button>
          ))}
        </div>
        {db.datingState.experiment.presetAudit.lastPreset ? (
          <p className="mb-2 text-[11px] text-muted-foreground">
            Last preset: <span className="font-semibold">{db.datingState.experiment.presetAudit.lastPreset}</span> · by{' '}
            <span className="font-semibold">{db.datingState.experiment.presetAudit.lastAppliedBy ?? 'unknown'}</span> ·{' '}
            <span className="font-semibold">
              {db.datingState.experiment.presetAudit.lastAppliedAt
                ? new Date(db.datingState.experiment.presetAudit.lastAppliedAt).toLocaleString()
                : '-'}
            </span>
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <label className="text-[11px] font-semibold text-muted-foreground">
            Min Exposures ({stabilityDraft.minExposurePerBucket})
            <input
              type="range"
              min={8}
              max={200}
              step={1}
              value={stabilityDraft.minExposurePerBucket}
              onChange={(e) =>
                setStabilityDraft((prev) => ({
                  ...prev,
                  minExposurePerBucket: Number(e.target.value),
                }))
              }
              onPointerUp={commitStabilityDraft}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-[11px] font-semibold text-muted-foreground">
            Confidence % ({(stabilityDraft.confidenceThreshold * 100).toFixed(1)})
            <input
              type="range"
              min={50}
              max={99.9}
              step={0.1}
              value={stabilityDraft.confidenceThreshold * 100}
              onChange={(e) =>
                setStabilityDraft((prev) => ({
                  ...prev,
                  confidenceThreshold: Number(e.target.value) / 100,
                }))
              }
              onPointerUp={commitStabilityDraft}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-[11px] font-semibold text-muted-foreground">
            Min Delta pp ({(stabilityDraft.minDelta * 100).toFixed(1)})
            <input
              type="range"
              min={0}
              max={20}
              step={0.1}
              value={stabilityDraft.minDelta * 100}
              onChange={(e) =>
                setStabilityDraft((prev) => ({
                  ...prev,
                  minDelta: Number(e.target.value) / 100,
                }))
              }
              onPointerUp={commitStabilityDraft}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-[11px] font-semibold text-muted-foreground">
            Cooldown m ({stabilityDraft.cooldownMinutes})
            <input
              type="range"
              min={5}
              max={180}
              step={1}
              value={stabilityDraft.cooldownMinutes}
              onChange={(e) =>
                setStabilityDraft((prev) => ({
                  ...prev,
                  cooldownMinutes: Number(e.target.value),
                }))
              }
              onPointerUp={commitStabilityDraft}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-[11px] font-semibold text-muted-foreground">
            Hold m ({stabilityDraft.minHoldMinutes})
            <input
              type="range"
              min={15}
              max={360}
              step={5}
              value={stabilityDraft.minHoldMinutes}
              onChange={(e) =>
                setStabilityDraft((prev) => ({
                  ...prev,
                  minHoldMinutes: Number(e.target.value),
                }))
              }
              onPointerUp={commitStabilityDraft}
              className="mt-1 w-full"
            />
          </label>
        </div>
      </div>

      <div className="mb-3 rounded-xl border border-border bg-background p-2.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <p className="font-black">
            Recommended Winner: {experimentWinner.bucket ? `Bucket ${experimentWinner.bucket}` : 'Insufficient data'}
          </p>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              experimentWinner.status === 'significant'
                ? 'bg-emerald-500/15 text-emerald-600'
                : experimentWinner.status === 'not_significant'
                  ? 'bg-amber-500/15 text-amber-600'
                  : experimentWinner.status === 'cooldown_locked' || experimentWinner.status === 'hold_locked'
                    ? 'bg-blue-500/15 text-blue-600'
                    : 'bg-muted text-muted-foreground'
            }`}
          >
            {experimentWinner.status === 'significant'
              ? 'Significant'
              : experimentWinner.status === 'not_significant'
                ? 'Needs more confidence'
                : experimentWinner.status === 'cooldown_locked'
                  ? 'Cooldown lock'
                  : experimentWinner.status === 'hold_locked'
                    ? 'Hold lock'
                    : 'Insufficient data'}
          </span>
        </div>
        <p className="text-muted-foreground">{experimentWinner.reason}</p>
        <p className="mt-1 font-semibold">
          Score {experimentWinner.score.toFixed(3)} · Confidence {(experimentWinner.confidence * 100).toFixed(1)}% · Delta {(experimentWinner.observedDelta * 100).toFixed(1)}pp
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Guardrails: min exposures per bucket {experimentWinner.minExposureRequired}, confidence {'>='}
          {(stabilityDraft.confidenceThreshold * 100).toFixed(1)}%, delta {'>='}
          {(stabilityDraft.minDelta * 100).toFixed(1)}pp, cooldown {stabilityDraft.cooldownMinutes}m, hold {stabilityDraft.minHoldMinutes}m
        </p>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-black tracking-wide">Ranking Tuning</h2>
        <span className="text-[11px] text-muted-foreground">
          Learned: age {db.datingState.learnedSignals.preferredAvgAge?.toFixed(0) ?? '-'} / distance {db.datingState.learnedSignals.preferredAvgDistanceKm?.toFixed(0) ?? '-'}km
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {(
          [
            ['distanceWeight', 'Distance'],
            ['affinityWeight', 'Affinity'],
            ['profileQualityWeight', 'Quality'],
            ['completenessWeight', 'Completion'],
            ['learningWeight', 'Learning'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-xs font-semibold text-muted-foreground">
            {label} ({rankingDraft[key].toFixed(1)})
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={rankingDraft[key]}
              onChange={(e) =>
                setRankingDraft((prev) => ({
                  ...prev,
                  [key]: Number(e.target.value),
                }))
              }
              onPointerUp={commitRankingDraft}
              className="mt-2 w-full"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
