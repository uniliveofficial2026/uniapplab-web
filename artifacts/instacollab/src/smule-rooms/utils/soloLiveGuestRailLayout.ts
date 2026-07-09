const STORAGE_PREFIX = 'solo-live-guest-rail-bottom:';

export const SOLO_LIVE_GUEST_RAIL_BOTTOM_FALLBACK_PX = 168;

export function readSoloLiveGuestRailBottom(
  roomId: string,
  fallback = SOLO_LIVE_GUEST_RAIL_BOTTOM_FALLBACK_PX,
): number {
  if (!roomId) return fallback;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${roomId}`);
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 96) return parsed;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function writeSoloLiveGuestRailBottom(roomId: string, bottomPx: number): void {
  if (!roomId || !Number.isFinite(bottomPx)) return;
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${roomId}`, String(Math.round(bottomPx)));
  } catch {
    /* ignore */
  }
}
