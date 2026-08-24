import type { UniLivesRTCProvider, UniLiveRoomType } from '@unilives/rtc-contracts';
import type { createControlPlaneStore, createTraceContext } from '@unilives/platform-core';

export declare const PLATFORM_VERSION: '0.1.0';

export type UniLiveEnvironment = 'development' | 'preview' | 'production' | 'local';

export type RequestInitWithTrace = RequestInit & {
  timeout?: number;
  retries?: number;
  idempotent?: boolean;
  traceContext?: Parameters<typeof createTraceContext>[0];
};

export declare function createRequestHelper(defaults?: {
  timeout?: number;
  retries?: number;
  traceContext?: Parameters<typeof createTraceContext>[0];
}): (url: string | URL, init?: RequestInitWithTrace) => Promise<Response>;

export declare function createUniLive(options: {
  projectId: string;
  environment?: UniLiveEnvironment;
  credentialPublicId?: string;
  controlPlane?: ReturnType<typeof createControlPlaneStore>;
  provider?: UniLivesRTCProvider;
  roomType?: UniLiveRoomType;
}): {
  projectId: string;
  environment: UniLiveEnvironment;
  platformVersion: typeof PLATFORM_VERSION;
  auth: Record<string, Function>;
  database: Record<string, unknown>;
  storage: Record<string, unknown>;
  realtime: Record<string, unknown>;
  rtc: { joinRoom: Function; runtime?: unknown };
  functions: Record<string, unknown>;
  events: { createTrace: typeof createTraceContext };
  observe: Record<string, Function>;
  request: ReturnType<typeof createRequestHelper>;
  controlPlane: ReturnType<typeof createControlPlaneStore>;
  registry: { list: Function; resolve: Function };
  usageMeter: { apply: Function; rollup: Function };
  projectGraph: { toJSON: Function; addPage: Function };
  authorize: (scope: string) => { ok: boolean; reason?: string };
};

export {
  createControlPlaneStore,
  createProviderRegistry,
  createProjectGraph,
  createTraceContext,
} from '@unilives/platform-core';
