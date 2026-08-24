/**
 * Host camera / beauty / LiveKit trace points.
 * Marks stay off the React render path.
 */

export const HOST_MEDIA_TRACE_POINTS = [
  'go_live_tap',
  'prejoin_painted',
  'camera_request_started',
  'camera_permission_resolved',
  'camera_track_created',
  'first_raw_frame',
  'beauty_prepare_started',
  'beauty_prepare_completed',
  'first_beauty_frame',
  'token_request_started',
  'token_received',
  'prepare_connection_started',
  'prepare_connection_completed',
  'room_connect_started',
  'room_connected',
  'publish_started',
  'track_published',
  'first_remote_frame',
  'camera_switch_started',
  'camera_switch_first_frame',
] as const;

export type HostMediaTracePoint = (typeof HOST_MEDIA_TRACE_POINTS)[number];

export type CameraLiveSloBudgets = {
  tapFeedbackMs: { p75: number; p95: number };
  prejoinShellMs: { p75: number; p95: number };
  firstFrameWarmMs: { p75: number; p95: number };
  firstFrameColdGrantedMs: { p75: number; p95: number };
  beautyControlMs: { p75: number; p95: number };
  cachedPresetMs: { p75: number; p95: number };
  defaultBeautyMs: { p75: number; p95: number };
  switchCameraMs: { p75: number; p95: number };
  beginConnectionMs: { p75: number; p95: number };
  publishPreparedMs: { p75: number; p95: number };
  cachedEffectMs: { p75: number; p95: number };
  uncachedEffectMs: { p75: number; p95: number };
};

export const CAMERA_LIVE_SLO: CameraLiveSloBudgets = {
  tapFeedbackMs: { p75: 100, p95: 200 },
  prejoinShellMs: { p75: 300, p95: 500 },
  firstFrameWarmMs: { p75: 400, p95: 700 },
  firstFrameColdGrantedMs: { p75: 800, p95: 1000 },
  beautyControlMs: { p75: 100, p95: 200 },
  cachedPresetMs: { p75: 300, p95: 500 },
  defaultBeautyMs: { p75: 500, p95: 1000 },
  switchCameraMs: { p75: 500, p95: 1000 },
  beginConnectionMs: { p75: 300, p95: 500 },
  publishPreparedMs: { p75: 500, p95: 1000 },
  cachedEffectMs: { p75: 300, p95: 500 },
  uncachedEffectMs: { p75: 1000, p95: 1500 },
};

type TraceStore = {
  originMs: number;
  marks: Map<string, number[]>;
};

function emptyStore(): TraceStore {
  return { originMs: 0, marks: new Map() };
}

let store: TraceStore = emptyStore();

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export function resetHostMediaTrace(originMs = nowMs()): void {
  store = { originMs, marks: new Map() };
}

export function markHostMediaTrace(point: HostMediaTracePoint | string, atMs = nowMs()): void {
  const rel = Math.max(0, atMs - (store.originMs || atMs));
  if (!store.originMs) store.originMs = atMs;
  const list = store.marks.get(point) ?? [];
  list.push(rel);
  store.marks.set(point, list);
}

export function getHostMediaTraceMarks(): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [key, values] of store.marks) out[key] = [...values];
  return out;
}

export function hostMediaTraceDelta(
  start: HostMediaTracePoint,
  end: HostMediaTracePoint,
): number | null {
  const a = store.marks.get(start)?.[0];
  const b = store.marks.get(end)?.[0];
  if (a == null || b == null) return null;
  return Math.max(0, b - a);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

export type PercentileSummary = {
  n: number;
  p50: number;
  p75: number;
  p95: number;
};

export function summarizeDurations(samples: number[]): PercentileSummary {
  const sorted = [...samples].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  return {
    n: sorted.length,
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p95: percentile(sorted, 95),
  };
}

export type CameraLiveSloRow = {
  metric: string;
  summary: PercentileSummary;
  budget: { p75: number; p95: number };
  pass: boolean;
  unmeasured: boolean;
};

export function evaluateCameraLiveSlo(
  durations: Record<string, number[]>,
  budgets: CameraLiveSloBudgets = CAMERA_LIVE_SLO,
): { pass: boolean; unmeasured: boolean; rows: CameraLiveSloRow[] } {
  const specs: Array<{ metric: keyof CameraLiveSloBudgets; key: string }> = [
    { metric: 'tapFeedbackMs', key: 'tapFeedbackMs' },
    { metric: 'prejoinShellMs', key: 'prejoinShellMs' },
    { metric: 'firstFrameWarmMs', key: 'firstFrameWarmMs' },
    { metric: 'firstFrameColdGrantedMs', key: 'firstFrameColdGrantedMs' },
    { metric: 'beautyControlMs', key: 'beautyControlMs' },
    { metric: 'cachedPresetMs', key: 'cachedPresetMs' },
    { metric: 'defaultBeautyMs', key: 'defaultBeautyMs' },
    { metric: 'switchCameraMs', key: 'switchCameraMs' },
    { metric: 'beginConnectionMs', key: 'beginConnectionMs' },
    { metric: 'publishPreparedMs', key: 'publishPreparedMs' },
    { metric: 'cachedEffectMs', key: 'cachedEffectMs' },
    { metric: 'uncachedEffectMs', key: 'uncachedEffectMs' },
  ];

  const rows: CameraLiveSloRow[] = specs.map(({ metric, key }) => {
    const samples = durations[key] ?? [];
    const summary = summarizeDurations(samples);
    const budget = budgets[metric];
    const unmeasured = summary.n === 0;
    const pass =
      !unmeasured && summary.p75 <= budget.p75 && summary.p95 <= budget.p95;
    return { metric, summary, budget, pass, unmeasured };
  });

  return {
    pass: rows.every((row) => row.pass),
    unmeasured: rows.some((row) => row.unmeasured),
    rows,
  };
}
