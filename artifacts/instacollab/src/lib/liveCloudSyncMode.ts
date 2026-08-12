/**
 * Live cloud sync pacing — cache-first UI; Realtime channels deliver updates.
 * Aggressive 1s polling was freezing the whole app (db.save → useDB re-render storm).
 */
export const LIVE_CLOUD_SYNC_AGGRESSIVE = false;

/**
 * Do NOT enable realtime polling mode — postgres_changes is the primary path.
 * Polling is a slow safety net only.
 */
export const LIVE_CLOUD_SYNC_REALTIME = false;

/**
 * Coalesce bursty tab/foreground kicks.
 * Keep tiny (one frame) — 0 caused infinite refresh↔dispatch recursion.
 */
export const LIVE_CLOUD_UI_COALESCE_MS = 32;

export function cloudTickCooldownMs(): number {
  if (LIVE_CLOUD_SYNC_REALTIME) return LIVE_CLOUD_UI_COALESCE_MS;
  return LIVE_CLOUD_SYNC_AGGRESSIVE ? 5_000 : 20_000;
}

export function cloudKickCooldownMs(): number {
  if (LIVE_CLOUD_SYNC_REALTIME) return LIVE_CLOUD_UI_COALESCE_MS;
  return LIVE_CLOUD_SYNC_AGGRESSIVE ? 8_000 : 25_000;
}

export function surfaceRefreshCooldownMs(all: boolean): number {
  if (LIVE_CLOUD_SYNC_REALTIME) return all ? 32 : 16;
  if (LIVE_CLOUD_SYNC_AGGRESSIVE) return all ? 5_000 : 2_000;
  return all ? 20_000 : 8_000;
}

/**
 * Fallback poll when Realtime briefly reconnects — not the primary delivery path.
 */
export function inboxPollIntervalMs(): number {
  if (LIVE_CLOUD_SYNC_REALTIME) return 15_000;
  return LIVE_CLOUD_SYNC_AGGRESSIVE ? 30_000 : 45_000;
}

export function presenceBeatIntervalMs(): number {
  if (LIVE_CLOUD_SYNC_REALTIME) return 20_000;
  return 45_000;
}

/**
 * Active visible screen safety net — disabled by default.
 * Realtime + tab-change refresh are enough; polling every screen froze the app.
 */
export function activeSurfacePollIntervalMs(): number {
  if (LIVE_CLOUD_SYNC_REALTIME) return 0;
  return 0;
}

/** Google Workspace tabs (Gmail, Calendar, Contacts, …) when OAuth linked. */
export function googleWorkspacePollIntervalMs(): number {
  if (LIVE_CLOUD_SYNC_REALTIME) return 30_000;
  return LIVE_CLOUD_SYNC_AGGRESSIVE ? 45_000 : 60_000;
}
