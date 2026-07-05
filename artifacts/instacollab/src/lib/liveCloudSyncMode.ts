/**
 * Testing mode: faster foreground/tab cloud pulls.
 * Set false after QA to reduce background network use.
 */
export const LIVE_CLOUD_SYNC_AGGRESSIVE = true;

export function cloudTickCooldownMs(): number {
  return LIVE_CLOUD_SYNC_AGGRESSIVE ? 5_000 : 20_000;
}

export function cloudKickCooldownMs(): number {
  return LIVE_CLOUD_SYNC_AGGRESSIVE ? 8_000 : 25_000;
}

export function surfaceRefreshCooldownMs(all: boolean): number {
  if (LIVE_CLOUD_SYNC_AGGRESSIVE) return all ? 5_000 : 2_000;
  return all ? 20_000 : 8_000;
}
