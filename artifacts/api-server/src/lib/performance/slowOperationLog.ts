import { logger } from "../logger";

export type SlowOperation = {
  traceId: string;
  route: string;
  operationId: string;
  durationMs: number;
  status: number;
  timeout?: boolean;
  errorClass?: string;
};

export function logSlowOperation(op: SlowOperation): void {
  logger.warn({
    msg: "slow_operation",
    traceId: op.traceId,
    route: op.route,
    operationId: op.operationId,
    durationMs: Math.round(op.durationMs),
    status: op.status,
    timeout: op.timeout || false,
    errorClass: op.errorClass || null,
  });
}
