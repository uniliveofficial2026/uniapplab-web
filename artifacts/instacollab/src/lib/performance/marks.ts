const ENABLED =
  typeof performance !== "undefined" &&
  (import.meta.env.DEV || import.meta.env.VITE_PERF_TRACE === "1");

export function perfMark(name: string): void {
  if (!ENABLED) return;
  try {
    performance.mark(name);
  } catch {
    /* ignore */
  }
}

export function perfMeasure(name: string, startMark: string, endMark?: string): number | null {
  if (!ENABLED) return null;
  try {
    const end = endMark || `${name}:end`;
    if (!endMark) performance.mark(end);
    const measure = performance.measure(name, startMark, end);
    return measure.duration;
  } catch {
    return null;
  }
}

export function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
