import {
  buildMetricsFromEvents,
  parseImportSchemaVersion,
  sanitizeImportedEvents,
  sanitizeImportedMode,
  sanitizeImportedPresetAudit,
  sanitizeImportedStability,
  type ExperimentEvent,
  type ExperimentMode,
  type ExperimentPresetAudit,
  type ExperimentStability,
} from './datingExperimentUtils';

export type ImportMergeMode = 'replace' | 'append';

export type ExperimentImportOutcome =
  | {
      ok: false;
      importedEvents: 0;
      message: string;
      schemaVersionUsed: number | null;
      migratedFrom: null;
    }
  | {
      ok: true;
      importedEvents: number;
      message: string;
      schemaVersionUsed: number;
      migratedFrom: number | null;
      nextExperiment: {
        mode: ExperimentMode;
        stability: ExperimentStability;
        presetAudit: ExperimentPresetAudit;
        events: ExperimentEvent[];
        metrics: ReturnType<typeof buildMetricsFromEvents>;
      };
    };

export function importDatingExperimentPayload(
  payload: unknown,
  mergeMode: ImportMergeMode,
  currentExperiment: {
    mode: ExperimentMode;
    stability: ExperimentStability;
    presetAudit: ExperimentPresetAudit;
    events: ExperimentEvent[];
  }
): ExperimentImportOutcome {
  if (!payload || typeof payload !== 'object') {
    return {
      ok: false,
      importedEvents: 0,
      message: 'Invalid payload',
      schemaVersionUsed: null,
      migratedFrom: null,
    };
  }
  const input = payload as {
    schemaVersion?: unknown;
    mode?: unknown;
    stability?: unknown;
    presetAudit?: unknown;
    events?: unknown;
  };
  const schema = parseImportSchemaVersion(input.schemaVersion);
  if (!schema.ok) {
    return {
      ok: false,
      importedEvents: 0,
      message: schema.message,
      schemaVersionUsed: schema.schemaVersionUsed,
      migratedFrom: schema.migratedFrom,
    };
  }

  const importedEvents = sanitizeImportedEvents(input.events);
  const nextMode = sanitizeImportedMode(input.mode, currentExperiment.mode);
  const nextStability = sanitizeImportedStability(input.stability, currentExperiment.stability);
  const nextPresetAudit = sanitizeImportedPresetAudit(input.presetAudit, currentExperiment.presetAudit);
  const mergedEvents =
    mergeMode === 'replace'
      ? importedEvents
      : [...currentExperiment.events, ...importedEvents].slice(-3000);

  return {
    ok: true,
    importedEvents: importedEvents.length,
    message:
      mergeMode === 'replace'
        ? `Replayed snapshot with ${importedEvents.length} events`
        : `Appended ${importedEvents.length} events`,
    schemaVersionUsed: schema.schemaVersionUsed,
    migratedFrom: schema.migratedFrom,
    nextExperiment: {
      mode: nextMode,
      stability: nextStability,
      presetAudit: nextPresetAudit,
      events: mergedEvents,
      metrics: buildMetricsFromEvents(mergedEvents),
    },
  };
}
