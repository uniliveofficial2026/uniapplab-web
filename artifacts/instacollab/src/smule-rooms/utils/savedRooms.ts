import { getAppUserId } from '../../lib/appUserId';

export interface SavedRoom {
  id: string;
  name: string;
  hostName?: string;
  level?: number;
  savedAt: number;
}

const STORAGE_PREFIX = 'savedPartyRooms';

function getSavedRoomsStorageKey(): string {
  return `${STORAGE_PREFIX}:${getAppUserId()}`;
}

function readSavedRooms(): SavedRoom[] {
  try {
    const raw = localStorage.getItem(getSavedRoomsStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedRoom[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSavedRooms(rooms: SavedRoom[]) {
  localStorage.setItem(getSavedRoomsStorageKey(), JSON.stringify(rooms));
  window.dispatchEvent(new CustomEvent('saved-rooms-updated'));
}

export function getSavedRooms(): SavedRoom[] {
  return readSavedRooms().sort((a, b) => b.savedAt - a.savedAt);
}

export function isRoomSavedById(roomId: string): boolean {
  return readSavedRooms().some((room) => room.id === roomId);
}

export function saveRoom(entry: Omit<SavedRoom, 'savedAt'>): void {
  const rooms = readSavedRooms().filter((room) => room.id !== entry.id);
  rooms.unshift({ ...entry, savedAt: Date.now() });
  writeSavedRooms(rooms);
}

export function removeSavedRoom(roomId: string): void {
  writeSavedRooms(readSavedRooms().filter((room) => room.id !== roomId));
}

/** Returns the new saved state (true = saved, false = removed). */
export function toggleSavedRoom(entry: Omit<SavedRoom, 'savedAt'>): boolean {
  if (isRoomSavedById(entry.id)) {
    removeSavedRoom(entry.id);
    return false;
  }
  saveRoom(entry);
  return true;
}
