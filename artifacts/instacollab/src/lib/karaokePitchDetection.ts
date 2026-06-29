/** Singing range mapped to the 0–100 studio lane (log scale). */
const MIN_VOCAL_HZ = 110;
const MAX_VOCAL_HZ = 520;

export function vocalHzToLanePitch(hz: number): number {
  if (!Number.isFinite(hz) || hz <= 0) return 0;
  const clamped = Math.min(MAX_VOCAL_HZ, Math.max(MIN_VOCAL_HZ, hz));
  const t =
    (Math.log(clamped) - Math.log(MIN_VOCAL_HZ)) /
    (Math.log(MAX_VOCAL_HZ) - Math.log(MIN_VOCAL_HZ));
  return Math.min(100, Math.max(0, t * 100));
}

export function computeRmsVolume(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i]!;
    sum += s * s;
  }
  const rms = Math.sqrt(sum / samples.length);
  return Math.min(100, Math.round(rms * 520));
}

/**
 * Autocorrelation pitch estimator for monophonic voice.
 * Returns fundamental frequency in Hz, or null when signal is too weak.
 */
export function detectPitchHz(samples: Float32Array, sampleRate: number): number | null {
  if (sampleRate <= 0 || samples.length < 64) return null;

  let rms = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i]!;
    rms += s * s;
  }
  rms = Math.sqrt(rms / samples.length);
  if (rms < 0.008) return null;

  const minPeriod = Math.max(2, Math.floor(sampleRate / MAX_VOCAL_HZ));
  const maxPeriod = Math.min(samples.length - 1, Math.ceil(sampleRate / MIN_VOCAL_HZ));

  let bestOffset = -1;
  let bestCorr = 0;

  for (let offset = minPeriod; offset <= maxPeriod; offset += 1) {
    let corr = 0;
    for (let i = 0; i < samples.length - offset; i += 1) {
      corr += samples[i]! * samples[i + offset]!;
    }
    const norm = corr / (samples.length - offset);
    if (norm > bestCorr) {
      bestCorr = norm;
      bestOffset = offset;
    }
  }

  if (bestOffset <= 0 || bestCorr < 0.01) return null;

  let refined = bestOffset;
  if (bestOffset > minPeriod && bestOffset < maxPeriod) {
    const y1 = bestOffset - 1;
    const y2 = bestOffset;
    const y3 = bestOffset + 1;
    let c1 = 0;
    let c2 = 0;
    let c3 = 0;
    for (let i = 0; i < samples.length - y3; i += 1) {
      c1 += samples[i]! * samples[i + y1]!;
      c2 += samples[i]! * samples[i + y2]!;
      c3 += samples[i]! * samples[i + y3]!;
    }
    const denom = c1 - 2 * c2 + c3;
    if (Math.abs(denom) > 1e-6) {
      refined = y2 + (c1 - c3) / (2 * denom);
    }
  }

  const hz = sampleRate / refined;
  if (hz < MIN_VOCAL_HZ * 0.9 || hz > MAX_VOCAL_HZ * 1.1) return null;
  return hz;
}

export function smoothLanePitch(prev: number, next: number, alpha = 0.38): number {
  if (next <= 0) return prev * 0.92;
  return prev * (1 - alpha) + next * alpha;
}

export function pitchDeltaLane(a: number, b: number): number {
  return Math.abs(a - b);
}
