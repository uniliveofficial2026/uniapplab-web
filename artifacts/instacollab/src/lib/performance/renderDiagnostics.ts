const ENABLED =
  typeof window !== "undefined" && (import.meta.env.DEV || import.meta.env.VITE_PERF_TRACE === "1");

export type LongTaskSample = { start: number; duration: number };

const longTasks: LongTaskSample[] = [];

export function installLongTaskObserver(): () => void {
  if (!ENABLED || typeof PerformanceObserver === "undefined") return () => undefined;
  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks.push({ start: entry.startTime, duration: entry.duration });
        if (longTasks.length > 80) longTasks.shift();
      }
    });
    obs.observe({ type: "longtask", buffered: true } as PerformanceObserverInit);
    return () => obs.disconnect();
  } catch {
    return () => undefined;
  }
}

export function readLongTasks(): LongTaskSample[] {
  return [...longTasks];
}

export function countLongTasksOver(ms: number): number {
  return longTasks.filter((t) => t.duration > ms).length;
}
