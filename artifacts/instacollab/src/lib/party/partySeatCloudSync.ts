import { ALL_SEAT_KEYS, type PartySeatMap, type RoomGuest, type SeatGuestRequest } from '../../smule-rooms/utils/roomSeats';
import type { SeatJoinMode } from '../../smule-rooms/utils/roomJoinPolicy';
import { normalizeSeatJoinMode, normalizeWhoCanBeSeated } from '../../smule-rooms/utils/roomJoinPolicy';

export type SeatsSyncPayload = {
  action: 'snapshot';
  seats: PartySeatMap;
  revision: number;
  senderId?: string;
  /** Pending seat join requests (approval mode). */
  guestRequests?: SeatGuestRequest[];
  /** free | approval — hosts broadcast authoritative value. */
  seatJoinMode?: SeatJoinMode;
  /** Anyone | Followers | Elite Only */
  whoCanBeSeated?: string;
  /** Platform / room staff forced snapshot — apply fully on receivers. */
  forceApply?: boolean;
  /** Users banned from all seats in this room (legacy id list). */
  seatBannedUserIds?: string[];
  /** Timed seat bans with expiry. */
  seatBans?: Array<{
    userId: string;
    expiresAt: number;
    durationMs: number;
    bannedAt: number;
  }>;
  /** Locked empty seats map. */
  lockedSeats?: Record<string, boolean>;
};

export function serializePartySeatMap(seats: PartySeatMap): Record<string, RoomGuest | null> {
  const out: Record<string, RoomGuest | null> = {};
  for (const key of ALL_SEAT_KEYS) {
    out[key] = seats[key] ?? null;
  }
  return out;
}

export function deserializePartySeatMap(raw: unknown): PartySeatMap | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const seats = {} as PartySeatMap;
  for (const key of ALL_SEAT_KEYS) {
    const guest = record[key];
    if (guest && typeof guest === 'object' && typeof (guest as RoomGuest).name === 'string') {
      seats[key] = guest as RoomGuest;
    } else {
      seats[key] = null;
    }
  }
  return seats;
}

function parseGuestRequests(raw: unknown): SeatGuestRequest[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: SeatGuestRequest[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    const id = String(item.id ?? '').trim();
    const name = String(item.name ?? '').trim();
    if (!id || !name) continue;
    out.push({
      id,
      name,
      avatar: String(item.avatar ?? ''),
      userId: typeof item.userId === 'string' ? item.userId : undefined,
      isElite: Boolean(item.isElite),
    });
  }
  return out;
}

export function parseSeatsSyncPayload(payload: unknown): SeatsSyncPayload | null {
  if (!payload || typeof payload !== 'object') return null;
  const row = payload as Record<string, unknown>;
  if (row.action !== 'snapshot') return null;
  const seats = deserializePartySeatMap(row.seats);
  if (!seats) return null;
  const revision = typeof row.revision === 'number' ? row.revision : Date.now();
  const senderId = typeof row.senderId === 'string' ? row.senderId : undefined;
  const guestRequests = parseGuestRequests(row.guestRequests);
  const seatJoinMode =
    row.seatJoinMode != null ? normalizeSeatJoinMode(String(row.seatJoinMode)) : undefined;
  const whoCanBeSeated =
    row.whoCanBeSeated != null ? normalizeWhoCanBeSeated(String(row.whoCanBeSeated)) : undefined;
  const forceApply = Boolean(row.forceApply);
  const seatBannedUserIds = Array.isArray(row.seatBannedUserIds)
    ? row.seatBannedUserIds.map((id) => String(id ?? '').trim()).filter(Boolean)
    : undefined;
  const seatBans = Array.isArray(row.seatBans)
    ? row.seatBans
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const ban = item as Record<string, unknown>;
          const userId = String(ban.userId ?? '').trim();
          const expiresAt = Number(ban.expiresAt);
          const durationMs = Number(ban.durationMs);
          const bannedAt = Number(ban.bannedAt);
          if (!userId || !Number.isFinite(expiresAt)) return null;
          return {
            userId,
            expiresAt,
            durationMs: Number.isFinite(durationMs) ? durationMs : 0,
            bannedAt: Number.isFinite(bannedAt) ? bannedAt : Date.now(),
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : undefined;
  const lockedSeats =
    row.lockedSeats && typeof row.lockedSeats === 'object'
      ? Object.fromEntries(
          Object.entries(row.lockedSeats as Record<string, unknown>).map(([key, value]) => [
            key,
            Boolean(value),
          ]),
        )
      : undefined;
  return {
    action: 'snapshot',
    seats,
    revision,
    senderId,
    guestRequests,
    seatJoinMode,
    whoCanBeSeated,
    forceApply,
    seatBannedUserIds,
    seatBans,
    lockedSeats,
  };
}

/** Merge a remote seat snapshot — owner / forced moderation broadcasts win; others merge seat-by-seat. */
export function mergeRemotePartySeats(
  local: PartySeatMap,
  remote: PartySeatMap,
  opts: { senderId: string; ownerUserId: string; forceApply?: boolean },
): PartySeatMap {
  if (opts.forceApply || (opts.senderId && opts.ownerUserId && opts.senderId === opts.ownerUserId)) {
    return { ...remote };
  }

  const next = { ...local };
  for (const key of ALL_SEAT_KEYS) {
    const remoteGuest = remote[key];
    const localGuest = local[key];

    if (!remoteGuest) {
      if (localGuest?.userId === opts.senderId) {
        next[key] = null;
      }
      continue;
    }

    if (!localGuest || localGuest.userId === opts.senderId || remoteGuest.userId === opts.senderId) {
      next[key] = remoteGuest;
    }
  }
  return next;
}
