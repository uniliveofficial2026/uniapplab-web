import { getRoomSettings, saveRoomSettings } from './storage';

export type SeatBanEntry = {
  userId: string;
  /** Unix ms when the ban ends. */
  expiresAt: number;
  /** Original duration in ms (for display). */
  durationMs: number;
  bannedAt: number;
};

export type SeatBanDurationPreset = '15m' | '30m' | '1h' | '1d' | 'custom';

export const SEAT_BAN_DURATION_PRESETS: Array<{
  id: Exclude<SeatBanDurationPreset, 'custom'>;
  label: string;
  ms: number;
}> = [
  { id: '15m', label: '15m', ms: 15 * 60 * 1000 },
  { id: '30m', label: '30m', ms: 30 * 60 * 1000 },
  { id: '1h', label: '1h', ms: 60 * 60 * 1000 },
  { id: '1d', label: '1d', ms: 24 * 60 * 60 * 1000 },
];

function normalizeId(id: string | null | undefined): string {
  return String(id ?? '').trim();
}

function normalizeEntry(raw: unknown, now = Date.now()): SeatBanEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const userId = normalizeId(typeof row.userId === 'string' ? row.userId : String(row.userId ?? ''));
  const expiresAt = Number(row.expiresAt);
  if (!userId || !Number.isFinite(expiresAt) || expiresAt <= now) return null;
  const durationMs = Number(row.durationMs);
  const bannedAt = Number(row.bannedAt);
  return {
    userId,
    expiresAt,
    durationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : Math.max(0, expiresAt - now),
    bannedAt: Number.isFinite(bannedAt) && bannedAt > 0 ? bannedAt : now,
  };
}

/** Persist both structured bans and legacy id list for older clients. */
function persistSeatBans(roomId: string, bans: SeatBanEntry[]): SeatBanEntry[] {
  const active = pruneExpiredSeatBans(bans);
  saveRoomSettings(roomId, {
    seatBans: active,
    seatBannedUserIds: active.map((entry) => entry.userId),
  });
  return active;
}

export function pruneExpiredSeatBans(bans: SeatBanEntry[], now = Date.now()): SeatBanEntry[] {
  return bans.filter((entry) => entry.expiresAt > now);
}

export function getSeatBans(roomId: string, now = Date.now()): SeatBanEntry[] {
  const settings = getRoomSettings(roomId);

  // Authoritative path once seatBans has been written (even if currently empty).
  if (Array.isArray(settings.seatBans)) {
    return pruneExpiredSeatBans(
      settings.seatBans
        .map((row) => normalizeEntry(row, now))
        .filter((row): row is SeatBanEntry => Boolean(row)),
      now,
    );
  }

  // Legacy: ids without structured bans — migrate once to a 1-day timed ban.
  const legacyIds = Array.isArray(settings.seatBannedUserIds)
    ? settings.seatBannedUserIds.map(normalizeId).filter(Boolean)
    : [];
  if (legacyIds.length === 0) return [];

  const migrated: SeatBanEntry[] = legacyIds.map((userId) => ({
    userId,
    bannedAt: now,
    durationMs: 24 * 60 * 60 * 1000,
    expiresAt: now + 24 * 60 * 60 * 1000,
  }));
  return persistSeatBans(roomId, migrated);
}

export function getSeatBannedUserIds(roomId: string, now = Date.now()): string[] {
  return getSeatBans(roomId, now).map((entry) => entry.userId);
}

export function getSeatBanForUser(
  roomId: string,
  userId: string | null | undefined,
  now = Date.now(),
): SeatBanEntry | null {
  const id = normalizeId(userId);
  if (!id) return null;
  return getSeatBans(roomId, now).find((entry) => entry.userId === id) ?? null;
}

export function isUserSeatBanned(
  roomId: string,
  userId: string | null | undefined,
  now = Date.now(),
): boolean {
  return Boolean(getSeatBanForUser(roomId, userId, now));
}

export function banUserFromSeats(
  roomId: string,
  userId: string,
  durationMs: number,
  now = Date.now(),
): SeatBanEntry[] {
  const id = normalizeId(userId);
  const duration = Math.max(60_000, Math.floor(durationMs));
  if (!id || !roomId) return getSeatBans(roomId, now);
  const next = pruneExpiredSeatBans(getSeatBans(roomId, now), now).filter((entry) => entry.userId !== id);
  next.push({
    userId: id,
    bannedAt: now,
    durationMs: duration,
    expiresAt: now + duration,
  });
  return persistSeatBans(roomId, next);
}

export function unbanUserFromSeats(roomId: string, userId: string, now = Date.now()): SeatBanEntry[] {
  const id = normalizeId(userId);
  if (!id || !roomId) return getSeatBans(roomId, now);
  const next = getSeatBans(roomId, now).filter((entry) => entry.userId !== id);
  return persistSeatBans(roomId, next);
}

export function setSeatBans(roomId: string, bans: SeatBanEntry[], now = Date.now()): SeatBanEntry[] {
  const normalized = bans
    .map((row) => normalizeEntry(row, now))
    .filter((row): row is SeatBanEntry => Boolean(row));
  return persistSeatBans(roomId, normalized);
}

/** @deprecated Prefer setSeatBans — kept for sync parsers that still send id lists. */
export function setSeatBannedUserIds(roomId: string, userIds: string[], now = Date.now()): string[] {
  const existing = getSeatBans(roomId, now);
  const byId = new Map(existing.map((entry) => [entry.userId, entry]));
  const next: SeatBanEntry[] = [];
  for (const rawId of userIds) {
    const id = normalizeId(rawId);
    if (!id) continue;
    const current = byId.get(id);
    if (current) {
      next.push(current);
    } else {
      next.push({
        userId: id,
        bannedAt: now,
        durationMs: 15 * 60 * 1000,
        expiresAt: now + 15 * 60 * 1000,
      });
    }
  }
  persistSeatBans(roomId, next);
  return next.map((entry) => entry.userId);
}

/** Drop expired bans from storage; returns true if anything changed. */
export function sweepExpiredSeatBans(roomId: string, now = Date.now()): boolean {
  const settings = getRoomSettings(roomId);
  const raw = Array.isArray(settings.seatBans) ? settings.seatBans : null;
  if (!raw) {
    // Trigger legacy migration / cleanup if only ids remain.
    const beforeIds = Array.isArray(settings.seatBannedUserIds) ? settings.seatBannedUserIds.length : 0;
    if (beforeIds === 0) return false;
    getSeatBans(roomId, now);
    return true;
  }

  const active = pruneExpiredSeatBans(
    raw.map((row) => normalizeEntry(row, now)).filter((row): row is SeatBanEntry => Boolean(row)),
    now,
  );
  if (active.length === raw.length) {
    const activeIds = new Set(active.map((entry) => entry.userId));
    const unchanged = raw.every((row) => {
      const id = normalizeId((row as SeatBanEntry)?.userId);
      return id && activeIds.has(id);
    });
    if (unchanged) return false;
  }
  persistSeatBans(roomId, active);
  return true;
}

export function formatSeatBanRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  if (mins > 0) return `${mins}m ${String(secs).padStart(2, '0')}s`;
  return `${secs}s`;
}

export function formatSeatBanDurationLabel(durationMs: number): string {
  const preset = SEAT_BAN_DURATION_PRESETS.find((entry) => entry.ms === durationMs);
  if (preset) return preset.label;
  const totalMin = Math.max(1, Math.round(durationMs / 60_000));
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

export function parseCustomSeatBanDurationMs(amount: string, unit: 'm' | 'h' | 'd'): number | null {
  const n = Number(String(amount).trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  const maxMinutes = 30 * 24 * 60; // 30 days
  const minutes = unit === 'm' ? n : unit === 'h' ? n * 60 : n * 24 * 60;
  if (minutes > maxMinutes) return null;
  return Math.max(1, Math.floor(minutes)) * 60_000;
}
