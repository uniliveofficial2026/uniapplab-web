/**
 * In-memory host live chart history — sampled for the whole live, not only while
 * the dashboard is open. Keys by roomId and resets when the live ends / room changes.
 */

export type LiveChartSample = {
  t: number;
  viewers: number;
  comments: number;
  likes: number;
  gifts: number;
  coins: number;
};

const histories = new Map<string, LiveChartSample[]>();
const MAX_SAMPLES = 360; // ~30 min at 5s
const WINDOW_MS = 60 * 60_000;

export function resetLiveChartHistory(roomId: string): void {
  histories.delete(roomId);
}

export function pushLiveChartSample(
  roomId: string,
  input: Omit<LiveChartSample, 't'> & { t?: number },
): LiveChartSample[] {
  if (!roomId) return [];
  const now = input.t ?? Date.now();
  const prev = histories.get(roomId) ?? [];
  const last = prev[prev.length - 1];
  // Avoid duplicate stamps within 2s unless counters moved.
  if (
    last &&
    now - last.t < 2_000 &&
    last.viewers === input.viewers &&
    last.comments === input.comments &&
    last.likes === input.likes &&
    last.gifts === input.gifts &&
    last.coins === input.coins
  ) {
    return prev;
  }
  const next = [
    ...prev,
    {
      t: now,
      viewers: Math.max(0, input.viewers),
      comments: Math.max(0, input.comments),
      likes: Math.max(0, input.likes),
      gifts: Math.max(0, input.gifts),
      coins: Math.max(0, input.coins),
    },
  ]
    .filter((s) => s.t >= now - WINDOW_MS)
    .slice(-MAX_SAMPLES);
  histories.set(roomId, next);
  return next;
}

export function getLiveChartHistory(roomId: string | undefined): LiveChartSample[] {
  if (!roomId) return [];
  return histories.get(roomId) ?? [];
}

/** Viewer counts for area chart — real samples only. */
export function viewerSeriesFromHistory(samples: LiveChartSample[], currentViewers: number): number[] {
  if (samples.length === 0) return [Math.max(0, currentViewers), Math.max(0, currentViewers)];
  if (samples.length === 1) {
    const v = samples[0].viewers;
    return [v, Math.max(v, currentViewers)];
  }
  const series = samples.map((s) => s.viewers);
  const last = series[series.length - 1];
  if (last !== currentViewers) series.push(Math.max(0, currentViewers));
  return series;
}

/**
 * Comments-per-minute from successive comment counters.
 * Each bar = comments gained in that interval × (60s / interval).
 */
export function commentsPerMinuteSeriesFromHistory(samples: LiveChartSample[], fallbackCpm: number): number[] {
  if (samples.length < 2) {
    const v = Math.max(0, fallbackCpm);
    return Array.from({ length: 12 }, () => Number(v.toFixed(1)));
  }
  const out: number[] = [];
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    const dtMin = Math.max((b.t - a.t) / 60_000, 1 / 60);
    const delta = Math.max(0, b.comments - a.comments);
    out.push(Number((delta / dtMin).toFixed(2)));
  }
  return out.slice(-24);
}

export function chartScale(values: number[]): { min: number; max: number; span: number } {
  const finite = values.filter((v) => Number.isFinite(v));
  const rawMax = finite.length ? Math.max(...finite) : 0;
  const max = Math.max(rawMax * 1.2, rawMax + 2, 4);
  const min = 0;
  return { min, max, span: Math.max(max - min, 1) };
}

export function seriesToAreaPath(values: number[], width: number, height: number, pad = 8): string {
  if (!values.length) return '';
  const { min, span } = chartScale(values);
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = height - pad - ((Math.max(0, v) - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  });
  const first = pts[0];
  const last = pts[pts.length - 1];
  const lastX = last.split(',')[0];
  return `M ${first} L ${pts.join(' L ')} L ${lastX},${height - pad} L ${pad},${height - pad} Z`;
}

export function seriesToLinePath(values: number[], width: number, height: number, pad = 8): string {
  if (!values.length) return '';
  const { min, span } = chartScale(values);
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = pad + i * step;
      const y = height - pad - ((Math.max(0, v) - min) / span) * (height - pad * 2);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

export function barHeights(values: number[]): number[] {
  if (!values.length) return [];
  const max = Math.max(...values, 0.1);
  return values.map((v) => Math.max(6, (Math.max(0, v) / max) * 100));
}
