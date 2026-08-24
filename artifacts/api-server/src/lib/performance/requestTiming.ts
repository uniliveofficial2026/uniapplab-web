import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { logSlowOperation } from "./slowOperationLog";
import { formatServerTiming } from "./serverTiming";
import { readPerfSpans } from "./spans";

export function requestTimingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const traceId = String(req.headers["x-trace-id"] || "").trim() || randomUUID();
  req.traceId = traceId;
  req.perfStartNs = process.hrtime.bigint();
  if (!res.headersSent) res.setHeader("x-trace-id", traceId);

  const originalEnd = res.end.bind(res);
  res.end = ((...args: Parameters<Response["end"]>) => {
    const start = req.perfStartNs || process.hrtime.bigint();
    const durMs = Number(process.hrtime.bigint() - start) / 1e6;
    if (!res.headersSent) {
      const emit =
        process.env.NODE_ENV !== "production" || process.env.PERF_SERVER_TIMING === "1";
      if (emit) {
        res.setHeader(
          "Server-Timing",
          formatServerTiming([{ name: "app", durMs }, ...readPerfSpans(req)]),
        );
      }
    }
    if (durMs >= 200) {
      logSlowOperation({
        traceId,
        route: String(req.originalUrl || req.url || "").split("?")[0],
        operationId: "http.request",
        durationMs: durMs,
        status: res.statusCode,
      });
    }
    return originalEnd(...args);
  }) as Response["end"];

  next();
}
