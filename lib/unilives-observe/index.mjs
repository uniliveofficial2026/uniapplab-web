import { createTraceContext } from '@unilives/platform-core';
import { redactFields, redactString } from './redact.mjs';

/**
 * UniLive Observe — normalize logs/metrics without exposing secrets.
 */
export function createUniLiveObserve(options = {}) {
  /** @type {any[]} */
  const buffer = [];
  const max = Math.max(100, Number(options.maxBuffer) || 2000);

  return {
    createTrace: createTraceContext,
    log(level, message, fields = {}) {
      const row = {
        level,
        message: redactString(message),
        ...redactFields(fields),
        at: new Date().toISOString(),
      };
      buffer.push(row);
      if (buffer.length > max) buffer.splice(0, buffer.length - max);
      return row;
    },
    getLogs({ limit = 50, level, source, q, traceId } = {}) {
      let rows = buffer.slice();
      if (level) rows = rows.filter((r) => r.level === level);
      if (source) rows = rows.filter((r) => r.source === source);
      if (traceId) rows = rows.filter((r) => r.traceId === traceId);
      if (q) {
        const needle = String(q).toLowerCase();
        rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(needle));
      }
      return rows.slice(-limit);
    },
    metric(name, value, tags = {}) {
      return this.log('metric', name, { value, ...redactFields(tags) });
    },
  };
}

export { redactFields, redactString };
