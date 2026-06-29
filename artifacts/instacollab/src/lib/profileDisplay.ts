import type { User } from '../types';
import { safeString } from './safe';

/** Human-readable profile title — display name first, never raw internal id. */
export function getProfileDisplayName(
  user: Partial<User> | null | undefined,
  fallback = 'User',
): string {
  const displayName = safeString(user?.displayName).trim();
  if (displayName) return displayName;
  const username = safeString(user?.username).trim();
  if (username) return username;
  return fallback;
}

/** @handle without @ prefix */
export function getProfileHandle(user: Partial<User> | null | undefined): string {
  return safeString(user?.username).trim().replace(/^@/, '');
}

/** @username for UI subtitles */
export function formatProfileHandle(user: Partial<User> | null | undefined): string {
  const handle = getProfileHandle(user);
  return handle ? `@${handle}` : '';
}

/** Show @handle under display name when they differ. */
export function shouldShowProfileHandle(user: Partial<User> | null | undefined): boolean {
  const displayName = safeString(user?.displayName).trim();
  const handle = getProfileHandle(user);
  if (!handle || !displayName) return false;
  return handle.toLowerCase() !== displayName.toLowerCase();
}

/** Toasts, blocks, @mentions — prefer username handle, else display name. */
export function getProfileMentionLabel(
  user: Partial<User> | null | undefined,
  fallback = 'user',
): string {
  const handle = getProfileHandle(user);
  if (handle) return handle;
  return getProfileDisplayName(user, fallback);
}
