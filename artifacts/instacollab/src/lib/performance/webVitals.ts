import { nowMs } from "./marks";

export type WebVitalsSnapshot = {
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  ttfbMs: number | null;
  sampledAt: number;
};

const ENABLED =
  typeof window !== "undefined" && (import.meta.env.DEV || import.meta.env.VITE_PERF_TRACE === "1");

let snapshot: WebVitalsSnapshot = {
  lcpMs: null,
  inpMs: null,
  cls: null,
  ttfbMs: null,
  sampledAt: 0,
};

export function installWebVitalsObserver(): () => void {
  if (!ENABLED || typeof PerformanceObserver === "undefined") return () => undefined;
  const observers: PerformanceObserver[] = [];
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav) snapshot.ttfbMs = nav.responseStart;
    const lcp = new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1) as PerformanceEntry & { startTime?: number };
      if (last?.startTime != null) snapshot.lcpMs = last.startTime;
      snapshot.sampledAt = nowMs();
    });
    lcp.observe({ type: "largest-contentful-paint", buffered: true } as PerformanceObserverInit);
    observers.push(lcp);
    const clsObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) {
        if (!entry.hadRecentInput) snapshot.cls = (snapshot.cls || 0) + (entry.value || 0);
      }
      snapshot.sampledAt = nowMs();
    });
    clsObs.observe({ type: "layout-shift", buffered: true } as PerformanceObserverInit);
    observers.push(clsObs);
    const inp = new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1) as PerformanceEntry & { duration?: number };
      if (last?.duration != null) snapshot.inpMs = last.duration;
      snapshot.sampledAt = nowMs();
    });
    inp.observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
    observers.push(inp);
  } catch {
    /* unsupported */
  }
  return () => observers.forEach((o) => o.disconnect());
}

export function readWebVitals(): WebVitalsSnapshot {
  return { ...snapshot };
}
