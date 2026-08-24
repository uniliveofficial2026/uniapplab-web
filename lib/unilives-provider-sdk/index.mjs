/**
 * Provider SDK — third parties implement adapters without importing platform internals.
 */

/** @typedef {'HEALTHY'|'DEGRADED'|'UNAVAILABLE'|'MISCONFIGURED'} ProviderHealthState */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   version: string,
 *   kind: 'rtc'|'auth'|'database'|'storage'|'realtime'|'functions'|'deployment'|'git'|'notification'|'ai',
 *   capabilities: string[],
 *   configSchema?: Record<string, unknown>,
 * }} ProviderManifest
 */

/**
 * @param {ProviderManifest} manifest
 */
export function validateProviderManifest(manifest) {
  if (!manifest?.id || !manifest?.name || !manifest?.version || !manifest?.kind) {
    throw new Error('invalid_provider_manifest');
  }
  if (!Array.isArray(manifest.capabilities)) throw new Error('capabilities_required');
  return true;
}

/**
 * @param {ProviderHealthState} state
 * @param {string} [reason]
 */
export function createProviderHealth(state, reason) {
  return { state, reason: reason || null, checkedAt: new Date().toISOString() };
}

/**
 * Minimal external Test/Fake RTC-capable provider through the public contract surface.
 * Does not import @unilives/platform-core internals.
 */
export function createTestRtcProviderAdapter() {
  const manifest = {
    id: 'test.rtc.fake',
    name: 'Test Fake RTC',
    version: '0.1.0',
    kind: /** @type {const} */ ('rtc'),
    capabilities: ['rtc.rooms', 'rtc.data'],
  };
  validateProviderManifest(manifest);
  /** @type {Map<string, { roomId: string }>} */
  const rooms = new Map();
  return {
    manifest,
    async health() {
      return createProviderHealth('HEALTHY');
    },
    async createRoom(roomId) {
      rooms.set(roomId, { roomId });
      return { roomId, provider: manifest.id };
    },
    async endRoom(roomId) {
      rooms.delete(roomId);
      return { ok: true };
    },
    listRooms() {
      return [...rooms.values()];
    },
  };
}

export function providerSupports(manifest, capability) {
  return Boolean(manifest?.capabilities?.includes(capability));
}
