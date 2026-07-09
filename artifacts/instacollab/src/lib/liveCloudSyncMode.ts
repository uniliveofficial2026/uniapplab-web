/**
 * Live cloud sync pacing — cache-first UI always; network merges in real time.
 * REALTIME: Supabase Realtime drives inbound; outbound pushes on next microtask.
 */
export const LIVE_CLOUD_SYNC_AGGRESSIVE = true;

/** Full real-time — minimal coalesce only (no multi-second pull cooldowns). */
export const LIVE_CLOUD_SYNC_REALTIME = true;

/** Coalesce rapid tab/foreground kicks so UI never flashes or repaints in bursts. */
export const LIVE_CLOUD_UI_COALESCE_MS = 2_500;

export function cloudTickCooldownMs(): number {
  if (LIVE_CLOUD_SYNC_REALTIME) return LIVE_CLOUD_UI_COALESCE_MS;
  return LIVE_CLOUD_SYNC_AGGRESSIVE ? 5_000 : 20_000;
}

export function cloudKickCooldownMs(): number {
  if (LIVE_CLOUD_SYNC_REALTIME) return LIVE_CLOUD_UI_COALESCE_MS;
  return LIVE_CLOUD_SYNC_AGGRESSIVE ? 8_000 : 25_000;
}

export function surfaceRefreshCooldownMs(all: boolean): number {
  if (LIVE_CLOUD_SYNC_REALTIME) return all ? LIVE_CLOUD_UI_COALESCE_MS : 1_500;
  if (LIVE_CLOUD_SYNC_AGGRESSIVE) return all ? 5_000 : 2_000;
  return all ? 20_000 : 8_000;
}

/** Fallback poll when Realtime reconnects — not the primary delivery path. */
export function inboxPollIntervalMs(): number {
  if (LIVE_CLOUD_SYNC_REALTIME) return 12_000;
  return LIVE_CLOUD_SYNC_AGGRESSIVE ? 30_000 : 45_000;
}

export function presenceBeatIntervalMs(): number {
  if (LIVE_CLOUD_SYNC_REALTIME) return 15_000;
  return 30_000;
}

/** Active visible screen — keeps wallet, workspace, search, etc. interactive. */
export function activeSurfacePollIntervalMs(): number {
  if (LIVE_CLOUD_SYNC_REALTIME) return 8_000;
  return LIVE_CLOUD_SYNC_AGGRESSIVE ? 15_000 : 30_000;
}

/** Google Workspace tabs (Gmail, Calendar, Contacts, …) when OAuth linked. */
export function googleWorkspacePollIntervalMs(): number {
  if (LIVE_CLOUD_SYNC_REALTIME) return 20_000;
  return LIVE_CLOUD_SYNC_AGGRESSIVE ? 45_000 : 60_000;
}
