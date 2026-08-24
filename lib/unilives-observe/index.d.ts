import type { createTraceContext } from '@unilives/platform-core';

export declare function createUniLiveObserve(options?: {
  maxBuffer?: number;
}): {
  createTrace: typeof createTraceContext;
  log: (
    level: string,
    message: string,
    fields?: Record<string, unknown>,
  ) => Record<string, unknown>;
  getLogs: (opts?: { limit?: number }) => Record<string, unknown>[];
  metric: (name: string, value: unknown, tags?: Record<string, unknown>) => Record<string, unknown>;
};
