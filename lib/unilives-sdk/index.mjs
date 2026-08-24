import { createUniLiveRTC } from '@unilives/rtc-client';
import {
  AuthError,
  NetworkError,
  ProviderError,
  RTCError,
  ValidationError,
} from '@unilives/errors';
import { createUniLiveObserve } from '@unilives/observe';
import {
  createControlPlaneStore,
  createProviderRegistry,
  createProjectGraph,
  createRtcUsageMeter,
  createTraceContext,
} from '@unilives/platform-core';

export const PLATFORM_VERSION = '0.1.0';

const VALID_ENVIRONMENTS = new Set(['development', 'preview', 'production', 'local']);

/**
 * @param {unknown} options
 */
function validateUniLiveConfig(options) {
  if (!options || typeof options !== 'object') {
    throw new ValidationError('options object is required');
  }
  const projectId = /** @type {{ projectId?: string }} */ (options).projectId;
  if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
    throw new ValidationError('projectId is required');
  }
  const environment =
    /** @type {{ environment?: string }} */ (options).environment ?? 'development';
  if (!VALID_ENVIRONMENTS.has(environment)) {
    throw new ValidationError('environment must be development, preview, production, or local', {
      details: { environment, allowed: [...VALID_ENVIRONMENTS] },
    });
  }
  return { .../** @type {Record<string, unknown>} */ (options), projectId: projectId.trim(), environment };
}

/**
 * @param {AbortSignal[]} signals
 * @returns {AbortSignal | undefined}
 */
function combineAbortSignals(signals) {
  const active = signals.filter(Boolean);
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const sig of active) {
    if (sig.aborted) {
      controller.abort();
      break;
    }
    sig.addEventListener('abort', onAbort, { once: true });
  }
  return controller.signal;
}

/**
 * HTTP helper with trace correlation. Retries only when `idempotent: true`.
 * @param {{ timeout?: number, retries?: number, traceContext?: Record<string, unknown> }} [defaults]
 */
export function createRequestHelper(defaults = {}) {
  const baseTrace = defaults.traceContext ? createTraceContext(defaults.traceContext) : null;

  return async function request(url, init = {}) {
    const trace = createTraceContext(init.traceContext || baseTrace || {});
    const timeoutMs = init.timeout ?? defaults.timeout ?? 30_000;
    const idempotent = Boolean(init.idempotent);
    const retries = idempotent ? Math.max(0, init.retries ?? defaults.retries ?? 0) : 0;

    const attempt = async (attemptNo) => {
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
      const signal = combineAbortSignals([init.abortSignal, timeoutController.signal]);

      try {
        const headers = new Headers(init.headers || {});
        if (!headers.has('x-trace-id')) headers.set('x-trace-id', trace.traceId);

        const res = await fetch(url, { ...init, headers, signal });
        return res;
      } catch (err) {
        if (err?.name === 'AbortError') {
          throw new NetworkError('Request aborted or timed out', { traceId: trace.traceId, cause: err });
        }
        if (idempotent && attemptNo < retries) {
          return attempt(attemptNo + 1);
        }
        throw new NetworkError(err?.message || 'Network request failed', {
          traceId: trace.traceId,
          cause: err,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    };

    return attempt(0);
  };
}

/**
 * Unified UniLive SDK foundation.
 * @param {{
 *   projectId: string,
 *   environment?: 'development' | 'preview' | 'production' | 'local',
 *   credentialPublicId?: string,
 *   controlPlane?: ReturnType<typeof createControlPlaneStore>,
 *   provider?: import('@unilives/rtc-contracts').UniLivesRTCProvider,
 *   roomType?: import('@unilives/rtc-contracts').UniLiveRoomType,
 * }} rawOptions
 */
export function createUniLive(rawOptions) {
  const options = validateUniLiveConfig(rawOptions);
  const controlPlane = options.controlPlane || createControlPlaneStore();
  const registry = createProviderRegistry();
  const usageMeter = createRtcUsageMeter();
  const observeClient = createUniLiveObserve();
  const request = createRequestHelper();

  const project = controlPlane.getProject(options.projectId) || {
    projectId: options.projectId,
    name: options.projectId,
  };
  const graph = createProjectGraph({ projectId: options.projectId, name: project.name });

  const authProvider = registry.resolve('auth')?.provider;

  /** Provider-neutral auth boundary (Supabase adapter plugs in later). */
  const auth = {
    async signUp() {
      throw new AuthError('Auth adapter required', {
        details: { code: 'AUTH_ADAPTER_REQUIRED', provider: authProvider },
      });
    },
    async signIn() {
      throw new AuthError('Auth adapter required', { details: { code: 'AUTH_ADAPTER_REQUIRED' } });
    },
    async signOut() {
      return { ok: true };
    },
    async getSession() {
      return null;
    },
    async refreshSession() {
      return null;
    },
    async getUser() {
      return null;
    },
  };

  const database = {
    provider: registry.resolve('database')?.provider || 'supabase',
    async query() {
      throw new ProviderError('Database adapter required', {
        details: { code: 'DATABASE_ADAPTER_REQUIRED' },
      });
    },
  };

  const storage = {
    provider: registry.resolve('storage')?.provider || 'cloudflare-r2',
    async upload() {
      throw new ProviderError('Storage adapter required', {
        details: { code: 'STORAGE_ADAPTER_REQUIRED' },
      });
    },
    async download() {},
    async delete() {},
    async list() {
      return [];
    },
    async signedUrl() {
      throw new ProviderError('Storage adapter required', {
        details: { code: 'STORAGE_ADAPTER_REQUIRED' },
      });
    },
  };

  const realtime = {
    provider: registry.resolve('realtime')?.provider || 'supabase',
    async publish() {
      throw new ProviderError('Realtime adapter required', {
        details: { code: 'REALTIME_ADAPTER_REQUIRED' },
      });
    },
    async subscribe() {
      return () => undefined;
    },
  };

  const functions = {
    provider: registry.resolve('functions')?.provider || 'vercel',
    async invoke() {
      throw new ProviderError('Functions adapter required', {
        details: { code: 'FUNCTIONS_ADAPTER_REQUIRED' },
      });
    },
  };

  const events = {
    createTrace: createTraceContext,
  };

  const observe = {
    createTrace: createTraceContext,
    log: observeClient.log.bind(observeClient),
    metric: observeClient.metric.bind(observeClient),
    async getLogs(opts) {
      const local = observeClient.getLogs(opts);
      const audit = controlPlane.listAudit({ limit: opts?.limit ?? 100 });
      return [...audit, ...local];
    },
    async getMetrics() {
      return usageMeter.rollup();
    },
  };

  const rtc = options.provider
    ? createUniLiveRTC({ provider: options.provider, roomType: options.roomType })
    : {
        async joinRoom() {
          throw new RTCError('RTC provider required', {
            details: {
              code: 'RTC_PROVIDER_REQUIRED',
              hint: 'Pass provider from @unilives/rtc-livekit or @unilives/rtc-fake',
            },
          });
        },
      };

  return {
    projectId: options.projectId,
    environment: options.environment,
    platformVersion: PLATFORM_VERSION,
    auth,
    database,
    storage,
    realtime,
    rtc,
    functions,
    events,
    observe,
    request,
    controlPlane,
    registry,
    usageMeter,
    projectGraph: graph,
    /**
     * Authorize MCP/CLI/API call against credential model.
     */
    authorize(scope) {
      if (!options.credentialPublicId) return { ok: false, reason: 'credential_required' };
      return controlPlane.authorize({
        credentialPublicId: options.credentialPublicId,
        projectId: options.projectId,
        requiredScope: scope,
      });
    },
  };
}

export { createControlPlaneStore, createProviderRegistry, createProjectGraph, createTraceContext };
