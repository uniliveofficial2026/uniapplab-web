import { readActiveDeviceUid } from './auth/deviceAccounts';
import { db } from './db/localDb';
import { safeLocalStorage } from './utils';

function parseStoredUserId(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === 'string' && parsed.trim()) return parsed.trim();
  } catch {
    /* plain string */
  }
  return trimmed.replace(/^"|"$/g, '') || null;
}

/** Stable app user id for per-user localStorage scopes (rooms, settings, etc.). */
export function getAppUserId(): string {
  const activeUid = readActiveDeviceUid()?.trim();
  if (activeUid) return activeUid;

  const dbId = db.currentUserId?.trim();
  if (dbId && db.isLoggedIn) return dbId;

  const fromStorage =
    parseStoredUserId(safeLocalStorage.getItem('currentUserId')) ??
    parseStoredUserId(safeLocalStorage.getItem('auth_user_id'));
  if (fromStorage) return fromStorage;

  if (dbId) return dbId;

  return 'guest';
}
