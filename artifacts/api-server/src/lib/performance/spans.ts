import type { Request } from "express";

export type PerfSpanMap = Record<string, { startNs: bigint; durMs?: number }>;

export function startPerfSpan(req: Request, name: string): void {
  if (!req.perfSpans) req.perfSpans = {};
  req.perfSpans[name] = { startNs: process.hrtime.bigint() };
}

export function endPerfSpan(req: Request, name: string): number {
  if (!req.perfSpans) req.perfSpans = {};
  const span = req.perfSpans[name];
  const start = span?.startNs || req.perfStartNs || process.hrtime.bigint();
  const durMs = Number(process.hrtime.bigint() - start) / 1e6;
  req.perfSpans[name] = { startNs: start, durMs };
  return durMs;
}

export function readPerfSpans(req: Request): Array<{ name: string; durMs: number }> {
  const spans = req.perfSpans || {};
  return Object.entries(spans)
    .filter(([, v]) => typeof v.durMs === "number")
    .map(([name, v]) => ({ name, durMs: v.durMs as number }));
}
