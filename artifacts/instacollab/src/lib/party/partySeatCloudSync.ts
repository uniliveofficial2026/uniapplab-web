import { ALL_SEAT_KEYS, type PartySeatMap, type RoomGuest } from '../../smule-rooms/utils/roomSeats';

export type SeatsSyncPayload = {
  action: 'snapshot';
  seats: PartySeatMap;
  revision: number;
  senderId?: string;
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

export function parseSeatsSyncPayload(payload: unknown): SeatsSyncPayload | null {
  if (!payload || typeof payload !== 'object') return null;
  const row = payload as Record<string, unknown>;
  if (row.action !== 'snapshot') return null;
  const seats = deserializePartySeatMap(row.seats);
  if (!seats) return null;
  const revision = typeof row.revision === 'number' ? row.revision : Date.now();
  const senderId = typeof row.senderId === 'string' ? row.senderId : undefined;
  return { action: 'snapshot', seats, revision, senderId };
}

/** Merge a remote seat snapshot — owner broadcasts win; others merge seat-by-seat. */
export function mergeRemotePartySeats(
  local: PartySeatMap,
  remote: PartySeatMap,
  opts: { senderId: string; ownerUserId: string },
): PartySeatMap {
  if (opts.senderId && opts.ownerUserId && opts.senderId === opts.ownerUserId) {
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
