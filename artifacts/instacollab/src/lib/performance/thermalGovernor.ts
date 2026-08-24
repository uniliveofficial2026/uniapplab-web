/**
 * App-wide thermal / resource governor (invisible — no UI).
 * Consumes platform signals when available; never overrides hardware throttling.
 * Does not reset beauty state, gift ledger state, or camera ownership.
 */

export type ThermalLevel = 'cool' | 'warm' | 'elevated' | 'hot' | 'critical';

export type ThermalPolicy = {
  level: ThermalLevel;
  /** Optional decorative FX / particles intensity 0..1 */
  fxBudget: number;
  /** Secondary AI / segmentation cadence multiplier */
  perceptionCadence: number;
  /** Prefetch / offscreen work allowed */
  allowPrefetch: boolean;
  /** Prefer 30fps publish when elevated+ */
  preferStable30Fps: boolean;
};

type Listener = (policy: ThermalPolicy) => void;

const listeners = new Set<Listener>();
let current: ThermalPolicy = {
  level: 'cool',
  fxBudget: 1,
  perceptionCadence: 1,
  allowPrefetch: true,
  preferStable30Fps: false,
};

function policyFor(level: ThermalLevel): ThermalPolicy {
  switch (level) {
    case 'cool':
      return { level, fxBudget: 1, perceptionCadence: 1, allowPrefetch: true, preferStable30Fps: false };
    case 'warm':
      return { level, fxBudget: 0.85, perceptionCadence: 0.85, allowPrefetch: true, preferStable30Fps: false };
    case 'elevated':
      return { level, fxBudget: 0.6, perceptionCadence: 0.55, allowPrefetch: false, preferStable30Fps: true };
    case 'hot':
      return { level, fxBudget: 0.35, perceptionCadence: 0.35, allowPrefetch: false, preferStable30Fps: true };
    case 'critical':
      return { level, fxBudget: 0.15, perceptionCadence: 0.2, allowPrefetch: false, preferStable30Fps: true };
  }
}

function emit(next: ThermalPolicy) {
  current = next;
  for (const listener of listeners) {
    try {
      listener(current);
    } catch {
      /* isolate */
    }
  }
}

/** Map Web/Chromium thermal or battery pressure into governor levels when exposed. */
export function ingestPlatformHint(input: {
  thermalState?: string | number | null;
  batterySaver?: boolean | null;
  memoryPressure?: 'normal' | 'moderate' | 'critical' | null;
}): ThermalLevel {
  let level: ThermalLevel = 'cool';
  const thermal = String(input.thermalState ?? '').toLowerCase();
  if (thermal.includes('critical') || thermal === '4') level = 'critical';
  else if (thermal.includes('serious') || thermal.includes('hot') || thermal === '3') level = 'hot';
  else if (thermal.includes('fair') || thermal.includes('elevated') || thermal === '2') level = 'elevated';
  else if (thermal.includes('warm') || thermal === '1') level = 'warm';

  if (input.batterySaver) {
    level = level === 'cool' ? 'warm' : level === 'warm' ? 'elevated' : level;
  }
  if (input.memoryPressure === 'critical') level = 'critical';
  else if (input.memoryPressure === 'moderate' && (level === 'cool' || level === 'warm')) level = 'elevated';

  emit(policyFor(level));
  return level;
}

export function getThermalPolicy(): ThermalPolicy {
  return current;
}

/**
 * Stretch perception / segmentation intervals when cadence < 1.
 * Does not reset beauty params, gift FX, or camera ownership.
 */
export function perceptionIntervalMs(baseMs: number): number {
  const cadence = Math.max(0.05, Math.min(1, current.perceptionCadence || 1));
  const base = Math.max(1, Number(baseMs) || 1);
  return Math.round(base / cadence);
}

/** Clamp WebAR/DeepAR output FPS by perceptionCadence (call at attach — avoid mid-stream restart). */
export function perceptionOutputFps(baseFps: number, minFps = 8): number {
  const cadence = Math.max(0.05, Math.min(1, current.perceptionCadence || 1));
  const base = Math.max(1, Number(baseFps) || 30);
  return Math.max(minFps, Math.round(base * cadence));
}

export function subscribeThermalPolicy(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

/** Best-effort browser wiring — no-op when APIs absent. Safe to call once at app boot. */
export function startThermalGovernor(): () => void {
  const cleanups: Array<() => void> = [];

  try {
    const conn = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    if (conn && typeof conn.addEventListener === 'function') {
      const onChange = () => ingestPlatformHint({ batterySaver: Boolean(conn.saveData) });
      conn.addEventListener('change', onChange);
      cleanups.push(() => conn.removeEventListener('change', onChange));
      onChange();
    }
  } catch {
    /* ignore */
  }

  try {
    const anyNav = navigator as Navigator & {
      deviceMemory?: number;
    };
    if (typeof anyNav.deviceMemory === 'number' && anyNav.deviceMemory > 0 && anyNav.deviceMemory <= 2) {
      ingestPlatformHint({ memoryPressure: 'moderate' });
    }
  } catch {
    /* ignore */
  }

  // Chromium experimental: document.thermalPressure / pressure observer — probe safely.
  try {
    const PressureObserver = (globalThis as { PressureObserver?: new (cb: (records: Array<{ state?: string }>) => void) => { observe: (opts: { source: string }) => Promise<void>; disconnect: () => void } }).PressureObserver;
    if (PressureObserver) {
      const observer = new PressureObserver((records) => {
        const state = records[records.length - 1]?.state;
        ingestPlatformHint({ thermalState: state });
      });
      void observer.observe({ source: 'thermals' }).catch(() => undefined);
      cleanups.push(() => observer.disconnect());
    }
  } catch {
    /* ignore */
  }

  return () => {
    for (const c of cleanups) c();
  };
}
