/**
 * Frame-time sampler for the host preview.
 * Values stay in this module — never push per-frame numbers into React.
 */

export type HostMediaFrameSnapshot = {
  sampleCount: number;
  dropped: number;
  lastFrameMs: number;
  p95FrameMs: number;
  fps: number;
};

const MAX_SAMPLES = 180;
const FRAME_BUDGET_MS = 33.4;

let samples: number[] = [];
let dropped = 0;
let lastTs = 0;
let raf = 0;
let running = false;

function percentile95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[idx]!;
}

function tick(ts: number): void {
  if (!running) return;
  if (lastTs > 0) {
    const dt = ts - lastTs;
    samples.push(dt);
    if (samples.length > MAX_SAMPLES) samples.shift();
    if (dt > FRAME_BUDGET_MS * 1.5) dropped += 1;
  }
  lastTs = ts;
  const rvfc = (
    globalThis as unknown as {
      requestVideoFrameCallback?: (cb: (now: number) => void) => number;
    }
  ).requestVideoFrameCallback;
  if (typeof rvfc === 'function') {
    raf = rvfc(tick);
    return;
  }
  raf = requestAnimationFrame(tick);
}

export function startHostMediaFrameStats(): void {
  if (running || typeof window === 'undefined') return;
  running = true;
  lastTs = 0;
  samples = [];
  dropped = 0;
  tick(typeof performance !== 'undefined' ? performance.now() : Date.now());
}

export function stopHostMediaFrameStats(): void {
  running = false;
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
  raf = 0;
  lastTs = 0;
}

export function getHostMediaFrameSnapshot(): HostMediaFrameSnapshot {
  const n = samples.length;
  const sum = samples.reduce((a, b) => a + b, 0);
  return {
    sampleCount: n,
    dropped,
    lastFrameMs: n ? samples[n - 1]! : 0,
    p95FrameMs: percentile95(samples),
    fps: sum > 0 ? Math.round((1000 * n) / sum) : 0,
  };
}

export function resetHostMediaFrameStats(): void {
  samples = [];
  dropped = 0;
  lastTs = 0;
}
