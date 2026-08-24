export class UniLiveError extends Error {
  code: string;
  details: Record<string, unknown>;
  traceId: string | null;
  constructor(
    code: string,
    message: string,
    opts?: { details?: Record<string, unknown>; cause?: unknown; traceId?: string },
  );
  toJSON(): {
    name: string;
    code: string;
    message: string;
    details: Record<string, unknown>;
    traceId: string | null;
  };
}

export class AuthError extends UniLiveError {}
export class ValidationError extends UniLiveError {}
export class PermissionError extends UniLiveError {}
export class NotFoundError extends UniLiveError {}
export class ConflictError extends UniLiveError {}
export class RateLimitError extends UniLiveError {}
export class ProviderError extends UniLiveError {}
export class NetworkError extends UniLiveError {}
export class RTCError extends UniLiveError {}
export class DeploymentError extends UniLiveError {}
