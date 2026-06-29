import type { StorageTier } from './dbRetention';

export function formatStorageBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export type StorageDeviceEstimate = {
  usage?: number;
  quota?: number;
} | null;

export function estimateCacheBytes(cache: Record<string, unknown>): number {
  let cacheEstimate = 0;
  for (const key in cache) {
    try {
      const val = JSON.stringify(cache[key]);
      cacheEstimate += (val.length + key.length) * 2;
    } catch {
      // skip non-serializable entries
    }
  }

  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) cacheEstimate += (localStorage.getItem(k)?.length || 0) * 2;
    }
  }

  return cacheEstimate;
}

export function buildStorageStats(args: {
  cache: Record<string, unknown>;
  tier: StorageTier;
  unlimited: boolean;
  offlineSync: boolean;
  deviceEstimate: StorageDeviceEstimate;
}) {
  const cacheEstimate = estimateCacheBytes(args.cache);
  const tier = args.tier;
  const unlimited = args.unlimited;

  const planLimitBytes = unlimited
    ? Number.POSITIVE_INFINITY
    : tier === '100GB'
      ? 100 * 1024 * 1024 * 1024
      : 50 * 1024 * 1024 * 1024;

  const browserUsageBytes =
    typeof args.deviceEstimate?.usage === 'number' ? args.deviceEstimate.usage : null;
  const browserQuotaBytes =
    typeof args.deviceEstimate?.quota === 'number' ? args.deviceEstimate.quota : null;

  const overPlanLimit =
    !unlimited && Number.isFinite(planLimitBytes) && cacheEstimate > planLimitBytes;

  const planLimitFormatted = unlimited ? 'Unlimited' : formatStorageBytes(planLimitBytes);
  const planUsageLabel = unlimited
    ? `${formatStorageBytes(cacheEstimate)} · Unlimited plan`
    : `${formatStorageBytes(cacheEstimate)} / ${planLimitFormatted}`;

  const meterPercent = unlimited
    ? null
    : planLimitBytes > 0
      ? Math.min(100, (cacheEstimate / planLimitBytes) * 100)
      : 0;

  const itemCount =
    Object.keys(args.cache).length +
    (typeof localStorage !== 'undefined' ? localStorage.length : 0);

  return {
    rawSize: cacheEstimate,
    size: formatStorageBytes(cacheEstimate),
    items: itemCount,
    tier,
    unlimited,
    offlineSync: args.offlineSync,
    planLimitBytes,
    planLimitLabel: unlimited ? 'Unlimited' : tier,
    planUsageLabel,
    usageBytes: cacheEstimate,
    usageLabel: planUsageLabel,
    quotaBytes: unlimited ? null : planLimitBytes,
    quotaLabel: unlimited ? null : planLimitFormatted,
    browserUsageBytes,
    browserQuotaBytes,
    browserUsageLabel: browserUsageBytes != null ? formatStorageBytes(browserUsageBytes) : null,
    browserQuotaLabel: browserQuotaBytes != null ? formatStorageBytes(browserQuotaBytes) : null,
    meterBytes: cacheEstimate,
    meterLimitBytes: unlimited ? null : planLimitBytes,
    overPlanLimit,
    meterPercent,
  };
}
