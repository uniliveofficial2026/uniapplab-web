import { createTraceContext } from '@unilives/platform-core';

/**
 * UniLive Observe — normalize logs/metrics without exposing secrets.
 */
export function createUniLiveObserve(options = {}) {
  /** @type {any[]} */
  const buffer = [];
  const max = Math.max(100, Number(options.maxBuffer) || 2000);

  function sanitize(fields = {}) {
    const out = { ...fields };
    for (const k of Object.keys(out)) {
      if (/secret|token|password|apikey|authorization/i.test(k)) delete out[k];
    }
    return out;
  }

  return {
    createTrace: createTraceContext,
    log(level, message, fields = {}) {
      const row = {
        level,
        message: String(message),
        ...sanitize(fields),
        at: new Date().toISOString(),
      };
      buffer.push(row);
      if (buffer.length > max) buffer.splice(0, buffer.length - max);
      return row;
    },
    getLogs({ limit = 50 } = {}) {
      return buffer.slice(-limit);
    },
    metric(name, value, tags = {}) {
      return this.log('metric', name, { value, ...sanitize(tags) });
    },
  };
}
