/**
 * Business realtime boundary — NOT LiveKit data channel as universal bus.
 * Lanes: RELIABLE_CONTROL | LOSS_TOLERANT | SERVER_AUTHORITATIVE
 */

export function createUniLiveRealtime(options = {}) {
  /** @type {Map<string, Set<Function>>} */
  const topics = new Map();
  const driver = options.driver || null;

  return {
    provider: options.provider || (driver ? 'external' : 'memory'),
    async publish({ topic, lane = 'RELIABLE_CONTROL', payload }) {
      if (driver?.publish) return driver.publish({ topic, lane, payload });
      for (const h of topics.get(topic) || []) h({ topic, lane, payload, receivedAt: new Date().toISOString() });
      return { ok: true };
    },
    subscribe(topic, handler) {
      if (driver?.subscribe) return driver.subscribe(topic, handler);
      if (!topics.has(topic)) topics.set(topic, new Set());
      topics.get(topic).add(handler);
      return () => topics.get(topic)?.delete(handler);
    },
  };
}
