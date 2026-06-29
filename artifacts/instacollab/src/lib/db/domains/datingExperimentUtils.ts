export type ExperimentBucket = 'A' | 'B' | 'C';
export type ExperimentMode = 'auto' | 'A' | 'B' | 'C';
export type ExperimentEventKind = 'exposure' | 'like' | 'pass' | 'match';
export type ExperimentWinnerStatus =
  | 'insufficient_data'
  | 'not_significant'
  | 'significant'
  | 'cooldown_locked'
  | 'hold_locked';

export type ExperimentMetrics = Record<
  ExperimentBucket,
  { exposures: number; likes: number; passes: number; matches: number }
>;

export type ExperimentEvent = {
  bucket: ExperimentBucket;
  kind: ExperimentEventKind;
  at: number;
};

export type ExperimentStability = {
  cooldownMinutes: number;
  minHoldMinutes: number;
  minExposurePerBucket: number;
  confidenceThreshold: number;
  minDelta: number;
};

export type ExperimentPresetAudit = {
  lastPreset: 'conservative' | 'balanced' | 'aggressive' | null;
  lastAppliedAt: number | null;
  lastAppliedBy: string | null;
};

export type ExperimentWinner = {
  bucket: ExperimentBucket | null;
  reason: string;
  score: number;
  confidence: number;
  status: ExperimentWinnerStatus;
  minExposureRequired: number;
  observedDelta: number;
};

export type ExperimentExportPayload = {
  schemaVersion: number;
  generatedAt: number;
  actorUserId: string | null;
  windowHours: number;
  mode: ExperimentMode;
  stability: ExperimentStability;
  presetAudit: ExperimentPresetAudit;
  summary: ExperimentMetrics;
  winner: ExperimentWinner;
  events: ExperimentEvent[];
};

export const CURRENT_DATING_EXPERIMENT_SCHEMA_VERSION = 2;

export const EMPTY_EXPERIMENT_METRICS: ExperimentMetrics = {
  A: { exposures: 0, likes: 0, passes: 0, matches: 0 },
  B: { exposures: 0, likes: 0, passes: 0, matches: 0 },
  C: { exposures: 0, likes: 0, passes: 0, matches: 0 },
};

export function createEmptyExperimentMetrics(): ExperimentMetrics {
  return {
    A: { exposures: 0, likes: 0, passes: 0, matches: 0 },
    B: { exposures: 0, likes: 0, passes: 0, matches: 0 },
    C: { exposures: 0, likes: 0, passes: 0, matches: 0 },
  };
}

export function clampWindowHours(hours: number): number {
  return Math.max(1, Math.min(24 * 30, Number(hours) || 24));
}

const summarizeRangeCache = new Map<string, ExperimentMetrics>();

function summarizeRangeCacheKey(events: ExperimentEvent[], since: number, until: number): string {
  const lastAt = events.length > 0 ? events[events.length - 1]?.at ?? 0 : 0;
  return `${events.length}|${lastAt}|${since}|${until}`;
}

export function summarizeEventsForRange(
  events: ExperimentEvent[],
  since: number,
  until: number
): ExperimentMetrics {
  const cacheKey = summarizeRangeCacheKey(events, since, until);
  const cached = summarizeRangeCache.get(cacheKey);
  if (cached) return cached;

  const summary = createEmptyExperimentMetrics();
  for (const event of events) {
    if (event.at < since || event.at > until) continue;
    if (event.kind === 'exposure') summary[event.bucket].exposures += 1;
    if (event.kind === 'like') summary[event.bucket].likes += 1;
    if (event.kind === 'pass') summary[event.bucket].passes += 1;
    if (event.kind === 'match') summary[event.bucket].matches += 1;
  }
  if (summarizeRangeCache.size > 48) summarizeRangeCache.clear();
  summarizeRangeCache.set(cacheKey, summary);
  return summary;
}

export function evaluateWinnerFromSummary(
  summary: ExperimentMetrics,
  stability: ExperimentStability
): ExperimentWinner {
  const minExposureRequired = stability.minExposurePerBucket;
  const weightedRate = (m: { exposures: number; likes: number; matches: number }) =>
    (m.likes + m.matches * 1.5) / Math.max(1, m.exposures);
  let bestBucket: ExperimentBucket | null = null;
  let bestScore = -1;
  let runnerUpScore = -1;
  for (const bucket of ['A', 'B', 'C'] as const) {
    const m = summary[bucket];
    if (m.exposures < minExposureRequired) continue;
    const engagement = weightedRate(m);
    if (engagement > bestScore) {
      runnerUpScore = bestScore;
      bestScore = engagement;
      bestBucket = bucket;
    } else if (engagement > runnerUpScore) {
      runnerUpScore = engagement;
    }
  }
  if (!bestBucket) {
    return {
      bucket: null,
      reason: `Not enough exposure in selected window (need >= ${minExposureRequired} per bucket).`,
      score: 0,
      confidence: 0,
      status: 'insufficient_data',
      minExposureRequired,
      observedDelta: 0,
    };
  }
  const winnerMetrics = summary[bestBucket];
  const winnerSuccesses = winnerMetrics.likes + winnerMetrics.matches;
  const winnerRate = winnerSuccesses / Math.max(1, winnerMetrics.exposures);
  let runnerUpBucket: ExperimentBucket | null = null;
  for (const bucket of ['A', 'B', 'C'] as const) {
    if (bucket === bestBucket) continue;
    if (summary[bucket].exposures < minExposureRequired) continue;
    if (!runnerUpBucket || weightedRate(summary[bucket]) > weightedRate(summary[runnerUpBucket])) {
      runnerUpBucket = bucket;
    }
  }
  if (!runnerUpBucket) {
    return {
      bucket: bestBucket,
      reason: 'Only one bucket meets minimum exposure threshold so significance cannot be established yet.',
      score: bestScore,
      confidence: 0,
      status: 'insufficient_data',
      minExposureRequired,
      observedDelta: 0,
    };
  }
  const runnerMetrics = summary[runnerUpBucket];
  const runnerSuccesses = runnerMetrics.likes + runnerMetrics.matches;
  const runnerRate = runnerSuccesses / Math.max(1, runnerMetrics.exposures);
  const pooled =
    (winnerSuccesses + runnerSuccesses) /
    Math.max(1, winnerMetrics.exposures + runnerMetrics.exposures);
  const stderr = Math.sqrt(
    Math.max(1e-9, pooled * (1 - pooled) * (1 / winnerMetrics.exposures + 1 / runnerMetrics.exposures))
  );
  const zScore = (winnerRate - runnerRate) / stderr;
  const confidence = Math.max(0, Math.min(1, 0.5 * (1 + Math.tanh(zScore / 2))));
  const observedDelta = winnerRate - runnerRate;
  const significant =
    confidence >= stability.confidenceThreshold && observedDelta >= stability.minDelta;
  return {
    bucket: bestBucket,
    reason: significant
      ? `Winner beats Bucket ${runnerUpBucket} with ${Math.round(confidence * 100)}% confidence and +${(observedDelta * 100).toFixed(1)}pp conversion uplift.`
      : `Top bucket leads, but confidence (${Math.round(confidence * 100)}%) or uplift (+${(observedDelta * 100).toFixed(1)}pp) is below guardrail.`,
    score: bestScore,
    confidence,
    status: significant ? 'significant' : 'not_significant',
    minExposureRequired,
    observedDelta,
  };
}

export function sanitizeImportedEvents(raw: unknown): ExperimentEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is ExperimentEvent =>
        Boolean(item) &&
        typeof item === 'object' &&
        ((item as { bucket?: unknown }).bucket === 'A' ||
          (item as { bucket?: unknown }).bucket === 'B' ||
          (item as { bucket?: unknown }).bucket === 'C') &&
        ((item as { kind?: unknown }).kind === 'exposure' ||
          (item as { kind?: unknown }).kind === 'like' ||
          (item as { kind?: unknown }).kind === 'pass' ||
          (item as { kind?: unknown }).kind === 'match') &&
        typeof (item as { at?: unknown }).at === 'number'
    )
    .slice(-3000);
}

export function sanitizeImportedMode(raw: unknown, fallback: ExperimentMode): ExperimentMode {
  return raw === 'auto' || raw === 'A' || raw === 'B' || raw === 'C' ? raw : fallback;
}

export function sanitizeImportedStability(
  raw: unknown,
  fallback: ExperimentStability
): ExperimentStability {
  if (!raw || typeof raw !== 'object') return fallback;
  const casted = raw as {
    cooldownMinutes?: unknown;
    minHoldMinutes?: unknown;
    minExposurePerBucket?: unknown;
    confidenceThreshold?: unknown;
    minDelta?: unknown;
  };
  return {
    cooldownMinutes: Math.max(
      5,
      Math.min(180, Number(casted.cooldownMinutes ?? fallback.cooldownMinutes))
    ),
    minHoldMinutes: Math.max(
      15,
      Math.min(24 * 60, Number(casted.minHoldMinutes ?? fallback.minHoldMinutes))
    ),
    minExposurePerBucket: Math.max(
      8,
      Math.min(2000, Number(casted.minExposurePerBucket ?? fallback.minExposurePerBucket))
    ),
    confidenceThreshold: Math.max(
      0.5,
      Math.min(0.999, Number(casted.confidenceThreshold ?? fallback.confidenceThreshold))
    ),
    minDelta: Math.max(0, Math.min(0.2, Number(casted.minDelta ?? fallback.minDelta))),
  };
}

export function sanitizeImportedPresetAudit(
  raw: unknown,
  fallback: ExperimentPresetAudit
): ExperimentPresetAudit {
  if (!raw || typeof raw !== 'object') return fallback;
  const casted = raw as {
    lastPreset?: unknown;
    lastAppliedAt?: unknown;
    lastAppliedBy?: unknown;
  };
  return {
    lastPreset:
      casted.lastPreset === 'conservative' ||
      casted.lastPreset === 'balanced' ||
      casted.lastPreset === 'aggressive'
        ? casted.lastPreset
        : fallback.lastPreset,
    lastAppliedAt:
      typeof casted.lastAppliedAt === 'number' ? casted.lastAppliedAt : fallback.lastAppliedAt,
    lastAppliedBy:
      typeof casted.lastAppliedBy === 'string' ? casted.lastAppliedBy : fallback.lastAppliedBy,
  };
}

export function buildExperimentCsv(payload: {
  summary: ExperimentMetrics;
  winner: ExperimentWinner;
  events: ExperimentEvent[];
}): string {
  const summaryRows = (['A', 'B', 'C'] as const).map((bucket) => {
    const m = payload.summary[bucket];
    return `summary,${bucket},,${m.exposures},${m.likes},${m.passes},${m.matches}`;
  });
  const winnerRow = `winner,${payload.winner.bucket ?? ''},${payload.winner.status},,${payload.winner.score.toFixed(4)},${(payload.winner.confidence * 100).toFixed(2)},${(payload.winner.observedDelta * 100).toFixed(2)}`;
  const eventRows = payload.events
    .map(
      (event) =>
        `event,${event.bucket},${event.kind},,,,,${new Date(event.at).toISOString()}`
    )
    .join('\n');
  return [
    'row_type,bucket,status,exposures,likes_or_score,passes_or_confidence,matches_or_delta,timestamp',
    ...summaryRows,
    winnerRow,
    eventRows,
  ]
    .filter(Boolean)
    .join('\n');
}

export function parseImportSchemaVersion(
  raw: unknown
):
  | { ok: true; schemaVersionUsed: number; migratedFrom: number | null }
  | { ok: false; message: string; schemaVersionUsed: number | null; migratedFrom: null } {
  const sourceSchemaRaw = Number(raw ?? 1);
  const sourceSchema = Number.isFinite(sourceSchemaRaw) ? Math.trunc(sourceSchemaRaw) : NaN;
  if (!Number.isFinite(sourceSchema) || sourceSchema < 1) {
    return {
      ok: false,
      message: 'Invalid schemaVersion in payload',
      schemaVersionUsed: null,
      migratedFrom: null,
    };
  }
  if (sourceSchema > CURRENT_DATING_EXPERIMENT_SCHEMA_VERSION) {
    return {
      ok: false,
      message: `Unsupported future schemaVersion ${sourceSchema}`,
      schemaVersionUsed: sourceSchema,
      migratedFrom: null,
    };
  }
  return {
    ok: true,
    schemaVersionUsed: sourceSchema,
    migratedFrom:
      sourceSchema < CURRENT_DATING_EXPERIMENT_SCHEMA_VERSION ? sourceSchema : null,
  };
}

export function buildMetricsFromEvents(events: ExperimentEvent[]): ExperimentMetrics {
  const metrics = createEmptyExperimentMetrics();
  for (const event of events) {
    if (event.kind === 'exposure') metrics[event.bucket].exposures += 1;
    if (event.kind === 'like') metrics[event.bucket].likes += 1;
    if (event.kind === 'pass') metrics[event.bucket].passes += 1;
    if (event.kind === 'match') metrics[event.bucket].matches += 1;
  }
  return metrics;
}

export function evaluateWinnerWithStability(
  params: {
    now: number;
    windowHours: number;
    events: ExperimentEvent[];
    stability: ExperimentStability;
    /** When provided, skips re-scanning events for the primary window. */
    precomputedSummary?: ExperimentMetrics;
  }
): ExperimentWinner {
  const safeHours = clampWindowHours(params.windowHours);
  const since = params.now - safeHours * 60 * 60 * 1000;
  const cooldownMs = params.stability.cooldownMinutes * 60 * 1000;
  const minHoldMs = params.stability.minHoldMinutes * 60 * 1000;

  const currentSummary =
    params.precomputedSummary ?? summarizeEventsForRange(params.events, since, params.now);
  const current = evaluateWinnerFromSummary(currentSummary, params.stability);
  if (current.status !== 'significant' || !current.bucket) return current;

  const anchor = evaluateWinnerFromSummary(
    summarizeEventsForRange(params.events, since, params.now - cooldownMs),
    params.stability
  );
  if (anchor.status === 'significant' && anchor.bucket && anchor.bucket !== current.bucket) {
    return {
      ...current,
      status: 'cooldown_locked',
      reason: `Candidate winner differs from pre-cooldown winner (Bucket ${anchor.bucket}). Wait ${params.stability.cooldownMinutes}m for stabilization.`,
    };
  }

  const hold = evaluateWinnerFromSummary(
    summarizeEventsForRange(params.events, params.now - minHoldMs, params.now),
    params.stability
  );
  if (hold.status !== 'significant' || hold.bucket !== current.bucket) {
    return {
      ...current,
      status: 'hold_locked',
      reason: `Winner has not held significance consistently for ${params.stability.minHoldMinutes}m.`,
    };
  }

  return current;
}

export function buildExperimentExportPayload(params: {
  now: number;
  windowHours: number;
  actorUserId: string | null;
  mode: ExperimentMode;
  stability: ExperimentStability;
  presetAudit: ExperimentPresetAudit;
  events: ExperimentEvent[];
}): ExperimentExportPayload {
  const safeHours = clampWindowHours(params.windowHours);
  const since = params.now - safeHours * 60 * 60 * 1000;
  const windowedEvents = params.events.filter((event) => event.at >= since && event.at <= params.now);
  const summary = summarizeEventsForRange(params.events, since, params.now);
  const winner = evaluateWinnerWithStability({
    now: params.now,
    windowHours: safeHours,
    events: params.events,
    stability: params.stability,
  });
  return {
    schemaVersion: CURRENT_DATING_EXPERIMENT_SCHEMA_VERSION,
    generatedAt: params.now,
    actorUserId: params.actorUserId,
    windowHours: safeHours,
    mode: params.mode,
    stability: params.stability,
    presetAudit: params.presetAudit,
    summary,
    winner,
    events: windowedEvents,
  };
}
