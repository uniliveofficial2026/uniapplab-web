/**
 * Non-production Cloudflare Realtime qualification adapter.
 * Does NOT dual-publish production video. Does NOT switch production SFU.
 */
export function createCloudflareRealtimeQualificationProvider(options = {}) {
  const available = Boolean(options.forceAvailable);
  return {
    provider: 'cloudflare-realtime',
    production: false,
    async probe() {
      return {
        ok: available,
        status: available ? 'qualified_lab_only' : 'not_enabled',
        note: 'Stage B qualifies Cloudflare Realtime behind UniLiveRTC contracts only in non-production labs.',
      };
    },
    async connect() {
      throw Object.assign(new Error('cloudflare_realtime_not_production'), {
        code: 'CF_REALTIME_LAB_ONLY',
      });
    },
  };
}
