import type { Request } from "express";

export type PerfSpanMap = Record<string, { startNs: bigint; durMs?: number }>;

export type PerfRequest = Request & {
  traceId?: string;
  perfStartNs?: bigint;
  perfSpans?: PerfSpanMap;
};

export function startPerfSpan(req: Request, name: string): void {
  const r = req as PerfRequest;
  if (!r.perfSpans) r.perfSpans = {};
  r.perfSpans[name] = { startNs: process.hrtime.bigint() };
}

export function endPerfSpan(req: Request, name: string): number {
  const r = req as PerfRequest;
  if (!r.perfSpans) r.perfSpans = {};
  const span = r.perfSpans[name];
  const start = span?.startNs || r.perfStartNs || process.hrtime.bigint();
  const durMs = Number(process.hrtime.bigint() - start) / 1e6;
  r.perfSpans[name] = { startNs: start, durMs };
  return durMs;
}

export function readPerfSpans(req: Request): Array<{ name: string; durMs: number }> {
  const r = req as PerfRequest;
  const spans = r.perfSpans || {};
  return Object.entries(spans)
    .filter((entry): entry is [string, { startNs: bigint; durMs: number }] => typeof entry[1]?.durMs === "number")
    .map(([name, v]) => ({ name, durMs: v.durMs }));
}
