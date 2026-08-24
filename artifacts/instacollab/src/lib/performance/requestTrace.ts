import { newTraceId } from "./actionTrace";

const TRACE_HEADER = "x-trace-id";

export function withTraceHeaders(headers: HeadersInit | undefined, traceId = newTraceId()): Headers {
  const next = new Headers(headers || {});
  if (!next.has(TRACE_HEADER)) next.set(TRACE_HEADER, traceId);
  return next;
}

export function readServerTiming(res: Response): Record<string, number> {
  const raw = res.headers.get("server-timing") || "";
  const out: Record<string, number> = {};
  for (const part of raw.split(",")) {
    const name = part.trim().split(";")[0];
    const dur = /dur=([\d.]+)/.exec(part);
    if (name && dur) out[name] = Number(dur[1]);
  }
  return out;
}

export { TRACE_HEADER };
