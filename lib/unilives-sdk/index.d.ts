import type { UniLivesRTCProvider, UniLiveRoomType } from '@unilives/rtc-contracts';
import type { createControlPlaneStore } from '@unilives/platform-core';

export function createUniLive(options: {
  projectId: string;
  credentialPublicId?: string;
  controlPlane?: ReturnType<typeof createControlPlaneStore>;
  provider?: UniLivesRTCProvider;
  roomType?: UniLiveRoomType;
}): {
  projectId: string;
  auth: Record<string, Function>;
  database: Record<string, unknown>;
  storage: Record<string, unknown>;
  realtime: Record<string, unknown>;
  rtc: { joinRoom: Function; runtime?: unknown };
  functions: Record<string, unknown>;
  events: Record<string, Function>;
  observe: Record<string, Function>;
  controlPlane: ReturnType<typeof createControlPlaneStore>;
  registry: { list: Function; resolve: Function };
  usageMeter: { apply: Function; rollup: Function };
  projectGraph: { toJSON: Function; addPage: Function };
  authorize: (scope: string) => { ok: boolean; reason?: string };
};

export { createControlPlaneStore, createProviderRegistry, createProjectGraph } from '@unilives/platform-core';
