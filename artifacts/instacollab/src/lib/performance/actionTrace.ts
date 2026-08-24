import { nowMs, perfMark, perfMeasure } from "./marks";

export type ActionTracePhase =
  | "input"
  | "first-visible"
  | "request-start"
  | "response"
  | "reconcile"
  | "commit"
  | "usable";

export type ActionTrace = {
  actionId: string;
  traceId: string;
  startedAt: number;
  phases: Partial<Record<ActionTracePhase, number>>;
};

const ENABLED =
  typeof window !== "undefined" && (import.meta.env.DEV || import.meta.env.VITE_PERF_TRACE === "1");

const active = new Map<string, ActionTrace>();

export function newTraceId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function startActionTrace(actionId: string, traceId = newTraceId()): ActionTrace {
  const trace: ActionTrace = { actionId, traceId, startedAt: nowMs(), phases: { input: 0 } };
  if (ENABLED) {
    active.set(traceId, trace);
    perfMark(`action:${actionId}:input`);
  }
  return trace;
}

/** Class A: paint existing pressed/tab feedback on the next frame. Does not wait on network. */
export function beginInstantAction(actionId: string): ActionTrace {
  const trace = startActionTrace(actionId);
  markActionPhase(trace.traceId, "first-visible");
  const finish = () => {
    markActionPhase(trace.traceId, "commit");
    endActionTrace(trace.traceId);
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(finish);
  else finish();
  return trace;
}

export function markActionPhase(traceId: string, phase: ActionTracePhase): void {
  const trace = active.get(traceId);
  if (!trace || !ENABLED) return;
  trace.phases[phase] = nowMs() - trace.startedAt;
  perfMark(`action:${trace.actionId}:${phase}`);
}

export function endActionTrace(traceId: string): ActionTrace | null {
  const trace = active.get(traceId);
  if (!trace) return null;
  markActionPhase(traceId, "usable");
  perfMeasure(`action:${trace.actionId}`, `action:${trace.actionId}:input`);
  active.delete(traceId);
  return trace;
}

export function readActiveTraces(): ActionTrace[] {
  return [...active.values()];
}
