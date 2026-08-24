import { createUniLiveRTC } from '@unilives/rtc-client';
import {
  createControlPlaneStore,
  createProviderRegistry,
  createProjectGraph,
  createRtcUsageMeter,
  createTraceContext,
} from '@unilives/platform-core';

/**
 * Unified UniLive SDK foundation.
 * @param {{ projectId: string, credentialPublicId?: string, controlPlane?: ReturnType<typeof createControlPlaneStore>, provider?: import('@unilives/rtc-contracts').UniLivesRTCProvider, roomType?: import('@unilives/rtc-contracts').UniLiveRoomType }} options
 */
export function createUniLive(options) {
  if (!options?.projectId) throw new Error('projectId_required');
  const controlPlane = options.controlPlane || createControlPlaneStore();
  const registry = createProviderRegistry();
  const usageMeter = createRtcUsageMeter();
  const project = controlPlane.getProject(options.projectId) || {
    projectId: options.projectId,
    name: options.projectId,
  };
  const graph = createProjectGraph({ projectId: options.projectId, name: project.name });

  /** Provider-neutral auth boundary (Supabase adapter plugs in later). */
  const auth = {
    async signUp() {
      throw Object.assign(new Error('auth_adapter_required'), { code: 'AUTH_ADAPTER_REQUIRED', provider: registry.resolve('auth')?.provider });
    },
    async signIn() {
      throw Object.assign(new Error('auth_adapter_required'), { code: 'AUTH_ADAPTER_REQUIRED' });
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
      throw Object.assign(new Error('database_adapter_required'), { code: 'DATABASE_ADAPTER_REQUIRED' });
    },
  };

  const storage = {
    provider: registry.resolve('storage')?.provider || 'cloudflare-r2',
    async upload() {
      throw Object.assign(new Error('storage_adapter_required'), { code: 'STORAGE_ADAPTER_REQUIRED' });
    },
    async download() {},
    async delete() {},
    async list() {
      return [];
    },
    async signedUrl() {
      throw Object.assign(new Error('storage_adapter_required'), { code: 'STORAGE_ADAPTER_REQUIRED' });
    },
  };

  const realtime = {
    provider: registry.resolve('realtime')?.provider || 'supabase',
    async publish() {
      throw Object.assign(new Error('realtime_adapter_required'), { code: 'REALTIME_ADAPTER_REQUIRED' });
    },
    async subscribe() {
      return () => undefined;
    },
  };

  const functions = {
    provider: registry.resolve('functions')?.provider || 'vercel',
    async invoke() {
      throw Object.assign(new Error('functions_adapter_required'), { code: 'FUNCTIONS_ADAPTER_REQUIRED' });
    },
  };

  const events = {
    createTrace: createTraceContext,
  };

  const observe = {
    createTrace: createTraceContext,
    async getLogs() {
      return controlPlane.listAudit({ limit: 100 });
    },
    async getMetrics() {
      return usageMeter.rollup();
    },
  };

  const rtc = options.provider
    ? createUniLiveRTC({ provider: options.provider, roomType: options.roomType })
    : {
        async joinRoom() {
          throw Object.assign(new Error('rtc_provider_required'), {
            code: 'RTC_PROVIDER_REQUIRED',
            hint: 'Pass provider from @unilives/rtc-livekit or @unilives/rtc-fake',
          });
        },
      };

  return {
    projectId: options.projectId,
    auth,
    database,
    storage,
    realtime,
    rtc,
    functions,
    events,
    observe,
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

export { createControlPlaneStore, createProviderRegistry, createProjectGraph };
