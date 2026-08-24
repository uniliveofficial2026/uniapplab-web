/**
 * UniLiveRTC QoE governor with hysteresis (ported from Stage A network policy semantics).
 */

/** @typedef {import('@unilives/rtc-contracts').QoeState} QoeState */
/** @typedef {import('@unilives/rtc-contracts').PublishProfile} PublishProfile */
/** @typedef {import('@unilives/rtc-contracts').RtcStats} RtcStats */

/**
 * @param {RtcStats} stats
 * @param {QoeState} [prev='GOOD']
 * @returns {QoeState}
 */
export function classifyQoe(stats, prev = 'GOOD') {
  const loss = Number(stats.packetLoss ?? 0);
  const rtt = Number(stats.rttMs ?? 0);
  const raw =
    loss >= 0.2 || rtt >= 800
      ? 'CRITICAL'
      : loss >= 0.1 || rtt >= 400
        ? 'POOR'
        : loss >= 0.05 || rtt >= 220
          ? 'DEGRADING'
          : 'GOOD';

  // Hysteresis: require recovery path rather than instant oscillation.
  if (prev === 'CRITICAL' && raw === 'POOR') return 'RECOVERING';
  if (prev === 'POOR' && raw === 'DEGRADING') return 'RECOVERING';
  if (prev === 'RECOVERING' && raw === 'GOOD') return 'GOOD';
  if (prev === 'RECOVERING' && (raw === 'DEGRADING' || raw === 'POOR')) return 'RECOVERING';
  if (prev === 'GOOD' && raw === 'DEGRADING') return 'DEGRADING';
  return raw;
}

/**
 * @param {QoeState} state
 * @param {{ thermal?: 'good'|'warm'|'hot'|'critical', topologyPublishers?: number }} [ctx]
 * @returns {PublishProfile}
 */
export function publishProfileForQoe(state, ctx = {}) {
  const pubs = Math.max(1, Number(ctx.topologyPublishers || 1));
  const thermal = ctx.thermal || 'good';
  if (state === 'CRITICAL' || thermal === 'critical') return 'LOW';
  if (state === 'POOR' || thermal === 'hot' || pubs >= 6) return 'LOW';
  if (state === 'DEGRADING' || state === 'RECOVERING' || thermal === 'warm' || pubs >= 4) return 'STANDARD';
  if (pubs === 1 && state === 'GOOD' && thermal === 'good') return 'HIGH';
  return 'STANDARD';
}

/**
 * Mutable governor for session lifetime.
 */
export function createQoeGovernor(initial = 'GOOD') {
  /** @type {QoeState} */
  let state = initial;
  return {
    getState() {
      return state;
    },
    /**
     * @param {RtcStats} stats
     * @param {{ thermal?: 'good'|'warm'|'hot'|'critical', topologyPublishers?: number }} [ctx]
     */
    update(stats, ctx) {
      state = classifyQoe(stats, state);
      return {
        state,
        publishProfile: publishProfileForQoe(state, ctx),
      };
    },
  };
}
