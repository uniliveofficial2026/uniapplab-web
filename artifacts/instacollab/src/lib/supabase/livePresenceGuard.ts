/**
 * Circuit breaker — stops live_kind / live_status queries that were hammering
 * Postgres when migrations were missing (root cause of connection timeouts).
 */
const BLOCK_KEY = 'instacollab_live_presence_blocked';

let blockedInMemory = false;

export function blockLivePresenceCloudQueries(): void {
  blockedInMemory = true;
  try {
    sessionStorage.setItem(BLOCK_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function unblockLivePresenceCloudQueries(): void {
  blockedInMemory = false;
  try {
    sessionStorage.removeItem(BLOCK_KEY);
  } catch {
    /* ignore */
  }
}

export function isLivePresenceCloudBlocked(): boolean {
  if (blockedInMemory) return true;
  try {
    return sessionStorage.getItem(BLOCK_KEY) === '1';
  } catch {
    return blockedInMemory;
  }
}

export function isMissingLiveColumnError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return (
    /live_kind|live_status|live_started_at/i.test(msg) &&
    /does not exist|column/i.test(msg)
  );
}
