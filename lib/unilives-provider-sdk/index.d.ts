export type ProviderHealthState = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'MISCONFIGURED';
export type ProviderManifest = {
  id: string;
  name: string;
  version: string;
  kind: string;
  capabilities: string[];
  configSchema?: Record<string, unknown>;
};
export function validateProviderManifest(manifest: ProviderManifest): true;
export function createProviderHealth(state: ProviderHealthState, reason?: string): {
  state: ProviderHealthState;
  reason: string | null;
  checkedAt: string;
};
export function createTestRtcProviderAdapter(): {
  manifest: ProviderManifest;
  health(): Promise<{ state: ProviderHealthState; reason: string | null; checkedAt: string }>;
  createRoom(roomId: string): Promise<{ roomId: string; provider: string }>;
  endRoom(roomId: string): Promise<{ ok: boolean }>;
  listRooms(): Array<{ roomId: string }>;
};
export function providerSupports(manifest: ProviderManifest, capability: string): boolean;
