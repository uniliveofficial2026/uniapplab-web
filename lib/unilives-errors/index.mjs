/**
 * @unilives/errors — consistent public error model. Never embed secrets.
 */

export class UniLiveError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{ details?: Record<string, unknown>, cause?: unknown, traceId?: string }} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = 'UniLiveError';
    this.code = String(code || 'UNILIVE_ERROR');
    this.details = sanitizeDetails(opts.details || {});
    this.traceId = opts.traceId || null;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      traceId: this.traceId,
    };
  }
}

function sanitizeDetails(details) {
  const out = { ...details };
  for (const k of Object.keys(out)) {
    if (/secret|password|token|authorization|apikey|private.?key|credential/i.test(k)) {
      out[k] = '[redacted]';
    }
  }
  return out;
}

export class AuthError extends UniLiveError {
  constructor(message, opts) {
    super('AUTH_ERROR', message, opts);
    this.name = 'AuthError';
  }
}
export class ValidationError extends UniLiveError {
  constructor(message, opts) {
    super('VALIDATION_ERROR', message, opts);
    this.name = 'ValidationError';
  }
}
export class PermissionError extends UniLiveError {
  constructor(message, opts) {
    super('PERMISSION_ERROR', message, opts);
    this.name = 'PermissionError';
  }
}
export class NotFoundError extends UniLiveError {
  constructor(message, opts) {
    super('NOT_FOUND', message, opts);
    this.name = 'NotFoundError';
  }
}
export class ConflictError extends UniLiveError {
  constructor(message, opts) {
    super('CONFLICT', message, opts);
    this.name = 'ConflictError';
  }
}
export class RateLimitError extends UniLiveError {
  constructor(message, opts) {
    super('RATE_LIMIT', message, opts);
    this.name = 'RateLimitError';
  }
}
export class ProviderError extends UniLiveError {
  constructor(message, opts) {
    super('PROVIDER_ERROR', message, opts);
    this.name = 'ProviderError';
  }
}
export class NetworkError extends UniLiveError {
  constructor(message, opts) {
    super('NETWORK_ERROR', message, opts);
    this.name = 'NetworkError';
  }
}
export class RTCError extends UniLiveError {
  constructor(message, opts) {
    super('RTC_ERROR', message, opts);
    this.name = 'RTCError';
  }
}
export class DeploymentError extends UniLiveError {
  constructor(message, opts) {
    super('DEPLOYMENT_ERROR', message, opts);
    this.name = 'DeploymentError';
  }
}
