/**
 * Network QoE governor — smoothed state machine with hysteresis.
 * Uses bitrate deltas, RTT, loss, quality labels from LiveKit telemetry.
 */

export type NetworkQoEState =
  | 'GOOD'
  | 'DEGRADING'
  | 'POOR'
  | 'CRITICAL'
  | 'RECOVERING';

export type NetworkQoESample = {
  atMs?: number;
  bitrateBps?: number | null;
  availableBandwidthBps?: number | null;
  rttMs?: number | null;
  jitterMs?: number | null;
  packetLossPct?: number | null;
  frameDropPct?: number | null;
  encoderLimited?: boolean | null;
  connectionQuality?: string | null;
  reconnecting?: boolean | null;
};

export type NetworkQoEPolicy = {
  state: NetworkQoEState;
  /** 0..1 publish aggressiveness */
  publishAggressiveness: number;
  preferStable30Fps: boolean;
  allowSimulcast: boolean;
  allowHighResSubscribe: boolean;
};

type Listener = (policy: NetworkQoEPolicy) => void;

const listeners = new Set<Listener>();
let state: NetworkQoEState = 'GOOD';
let smoothedScore = 1;
let lastTransitionAt = 0;

const HYSTERESIS_MS = 2500;

function qualityToScore(q: string | null | undefined): number | null {
  if (!q) return null;
  const s = q.toLowerCase();
  if (s.includes('excellent') || s === '5') return 1;
  if (s.includes('good') || s === '4') return 0.85;
  if (s.includes('poor') || s === '2') return 0.35;
  if (s.includes('lost') || s.includes('critical') || s === '1' || s === '0') return 0.1;
  if (s.includes('fair') || s === '3') return 0.55;
  return null;
}

function sampleScore(sample: NetworkQoESample): number {
  let score = 1;
  const q = qualityToScore(sample.connectionQuality);
  if (q != null) score = Math.min(score, q);

  const loss = sample.packetLossPct;
  if (typeof loss === 'number' && Number.isFinite(loss)) {
    if (loss >= 12) score = Math.min(score, 0.15);
    else if (loss >= 6) score = Math.min(score, 0.35);
    else if (loss >= 3) score = Math.min(score, 0.55);
    else if (loss >= 1) score = Math.min(score, 0.75);
  }

  const rtt = sample.rttMs;
  if (typeof rtt === 'number' && Number.isFinite(rtt)) {
    if (rtt >= 450) score = Math.min(score, 0.2);
    else if (rtt >= 280) score = Math.min(score, 0.4);
    else if (rtt >= 180) score = Math.min(score, 0.65);
  }

  const drops = sample.frameDropPct;
  if (typeof drops === 'number' && Number.isFinite(drops) && drops >= 8) {
    score = Math.min(score, 0.4);
  }

  if (sample.encoderLimited) score = Math.min(score, 0.45);
  if (sample.reconnecting) score = Math.min(score, 0.2);

  const bw = sample.availableBandwidthBps;
  const br = sample.bitrateBps;
  if (typeof bw === 'number' && bw > 0 && typeof br === 'number' && br > bw * 0.95) {
    score = Math.min(score, 0.5);
  }

  return Math.max(0, Math.min(1, score));
}

function stateFromScore(score: number, prev: NetworkQoEState): NetworkQoEState {
  if (score >= 0.78) return prev === 'POOR' || prev === 'CRITICAL' || prev === 'DEGRADING' ? 'RECOVERING' : 'GOOD';
  if (score >= 0.55) return prev === 'GOOD' ? 'DEGRADING' : prev === 'RECOVERING' ? 'RECOVERING' : 'DEGRADING';
  if (score >= 0.3) return 'POOR';
  return 'CRITICAL';
}

function policyFor(s: NetworkQoEState): NetworkQoEPolicy {
  switch (s) {
    case 'GOOD':
      return {
        state: s,
        publishAggressiveness: 1,
        preferStable30Fps: false,
        allowSimulcast: true,
        allowHighResSubscribe: true,
      };
    case 'RECOVERING':
      return {
        state: s,
        publishAggressiveness: 0.75,
        preferStable30Fps: true,
        allowSimulcast: true,
        allowHighResSubscribe: true,
      };
    case 'DEGRADING':
      return {
        state: s,
        publishAggressiveness: 0.65,
        preferStable30Fps: true,
        allowSimulcast: true,
        allowHighResSubscribe: false,
      };
    case 'POOR':
      return {
        state: s,
        publishAggressiveness: 0.4,
        preferStable30Fps: true,
        allowSimulcast: false,
        allowHighResSubscribe: false,
      };
    case 'CRITICAL':
      return {
        state: s,
        publishAggressiveness: 0.2,
        preferStable30Fps: true,
        allowSimulcast: false,
        allowHighResSubscribe: false,
      };
  }
}

let currentPolicy = policyFor('GOOD');

function emit(next: NetworkQoEPolicy) {
  currentPolicy = next;
  for (const l of listeners) {
    try {
      l(currentPolicy);
    } catch {
      /* isolate */
    }
  }
}

/** Ingest a telemetry sample; returns updated policy. */
export function ingestNetworkQoESample(sample: NetworkQoESample): NetworkQoEPolicy {
  const at = sample.atMs ?? Date.now();
  const raw = sampleScore(sample);
  // Exponential smoothing
  smoothedScore = smoothedScore * 0.72 + raw * 0.28;
  const candidate = stateFromScore(smoothedScore, state);

  if (candidate !== state) {
    const improving =
      (state === 'CRITICAL' && candidate !== 'CRITICAL') ||
      (state === 'POOR' && (candidate === 'DEGRADING' || candidate === 'RECOVERING' || candidate === 'GOOD')) ||
      (state === 'DEGRADING' && (candidate === 'RECOVERING' || candidate === 'GOOD')) ||
      (state === 'RECOVERING' && candidate === 'GOOD');
    const degrading = !improving && candidate !== state;
    // Faster to enter worse states; hysteresis when recovering.
    if (degrading || at - lastTransitionAt >= HYSTERESIS_MS) {
      state = candidate === 'GOOD' && smoothedScore < 0.82 ? 'RECOVERING' : candidate;
      if (state === 'RECOVERING' && smoothedScore >= 0.9) state = 'GOOD';
      lastTransitionAt = at;
      emit(policyFor(state));
    }
  } else if (state === 'RECOVERING' && smoothedScore >= 0.9 && at - lastTransitionAt >= HYSTERESIS_MS) {
    state = 'GOOD';
    lastTransitionAt = at;
    emit(policyFor(state));
  }

  return currentPolicy;
}

export function getNetworkQoEPolicy(): NetworkQoEPolicy {
  return currentPolicy;
}

export function subscribeNetworkQoE(listener: Listener): () => void {
  listeners.add(listener);
  listener(currentPolicy);
  return () => {
    listeners.delete(listener);
  };
}

/** Test helper */
export function resetNetworkQoEForTests(): void {
  state = 'GOOD';
  smoothedScore = 1;
  lastTransitionAt = 0;
  currentPolicy = policyFor('GOOD');
}
