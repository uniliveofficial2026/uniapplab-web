/**
 * Session registry so End Live stays permanent even if an in-flight
 * party-room upsert or presence heartbeat completes after teardown.
 * Survives same-tab refresh via sessionStorage; cleared when the host
 * intentionally starts a new live.
 */

const STORAGE_KEY = 'unilive.host_live_ended.v1';

const endedRoomIds = new Set<string>();
const endedHostUserIds = new Set<string>();

function norm(value: string | null | undefined): string {
  return String(value || '').trim();
}

function readPersisted(): { rooms: string[]; hosts: string[] } {
  if (typeof sessionStorage === 'undefined') return { rooms: [], hosts: [] };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { rooms: [], hosts: [] };
    const parsed = JSON.parse(raw) as { rooms?: unknown; hosts?: unknown };
    return {
      rooms: Array.isArray(parsed.rooms) ? parsed.rooms.map((v) => norm(String(v))).filter(Boolean) : [],
      hosts: Array.isArray(parsed.hosts) ? parsed.hosts.map((v) => norm(String(v))).filter(Boolean) : [],
    };
  } catch {
    return { rooms: [], hosts: [] };
  }
}

function persist(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        rooms: [...endedRoomIds],
        hosts: [...endedHostUserIds],
      }),
    );
  } catch {
    /* private mode / quota */
  }
}

function hydrateOnce(): void {
  const { rooms, hosts } = readPersisted();
  for (const room of rooms) endedRoomIds.add(room);
  for (const host of hosts) endedHostUserIds.add(host);
}

hydrateOnce();

export function markHostLiveEnded(roomId: string, hostUserId?: string | null): void {
  const room = norm(roomId);
  const host = norm(hostUserId);
  if (room) endedRoomIds.add(room);
  if (host) endedHostUserIds.add(host);
  persist();
}

export function clearHostLiveEnded(input?: {
  roomId?: string | null;
  hostUserId?: string | null;
}): void {
  const room = norm(input?.roomId);
  const host = norm(input?.hostUserId);
  if (room) endedRoomIds.delete(room);
  if (host) endedHostUserIds.delete(host);
  if (!room && !host) {
    endedRoomIds.clear();
    endedHostUserIds.clear();
  }
  persist();
}

export function isHostLiveEnded(roomId: string | null | undefined): boolean {
  const room = norm(roomId);
  return Boolean(room && endedRoomIds.has(room));
}

export function isHostUserLiveEnded(hostUserId: string | null | undefined): boolean {
  const host = norm(hostUserId);
  return Boolean(host && endedHostUserIds.has(host));
}

/** Test helper — wipe memory + session persistence. */
export function resetHostLiveEndedRegistryForTests(): void {
  endedRoomIds.clear();
  endedHostUserIds.clear();
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
