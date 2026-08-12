import type { User } from '../types';
import type { ProfileRow } from './supabase/types';

export const PUBLIC_USER_ID_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const PUBLIC_USER_ID_MIN_LENGTH = 3;
export const PUBLIC_USER_ID_MAX_LENGTH = 24;

export function normalizePublicUserId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, PUBLIC_USER_ID_MAX_LENGTH);
}

export function validatePublicUserId(
  raw: string
): { ok: true; value: string } | { ok: false; reason: string } {
  const value = normalizePublicUserId(raw);
  if (value.length < PUBLIC_USER_ID_MIN_LENGTH) {
    return {
      ok: false,
      reason: `User ID must be at least ${PUBLIC_USER_ID_MIN_LENGTH} characters`,
    };
  }
  if (!/^[a-z0-9_]{3,24}$/.test(value)) {
    return { ok: false, reason: 'User ID can only use letters, numbers, and underscores' };
  }
  return { ok: true, value };
}

export function resolvePublicUserId(user: Pick<User, 'publicUserId' | 'username'>): string {
  const fromField = user.publicUserId?.trim();
  if (fromField) return normalizePublicUserId(fromField);
  return normalizePublicUserId(user.username || '');
}

export function profileRowPublicUserIdChangedMs(row: ProfileRow): number | undefined {
  if (!row.public_user_id_changed_at) return undefined;
  const parsed = Date.parse(row.public_user_id_changed_at);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function canChangePublicUserId(
  changedAtMs: number | undefined,
  now = Date.now()
): boolean {
  if (changedAtMs == null || !Number.isFinite(changedAtMs)) return true;
  return now - changedAtMs >= PUBLIC_USER_ID_COOLDOWN_MS;
}

export function publicUserIdCooldownMessage(
  changedAtMs: number | undefined,
  now = Date.now()
): string | null {
  if (canChangePublicUserId(changedAtMs, now)) return null;
  const remainingMs = PUBLIC_USER_ID_COOLDOWN_MS - (now - (changedAtMs as number));
  const days = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  if (days <= 1) return 'You can change your User ID again in less than a day.';
  return `You can change your User ID again in ${days} days.`;
}

export function isLocalPublicUserIdAvailable(
  users: User[],
  publicUserId: string,
  exceptAuthId?: string | string[]
): boolean {
  const normalized = normalizePublicUserId(publicUserId);
  const except = new Set(
    (Array.isArray(exceptAuthId) ? exceptAuthId : exceptAuthId ? [exceptAuthId] : [])
      .map((id) => id.trim())
      .filter(Boolean),
  );
  return !users.some((u) => {
    if (except.has(u.id)) return false;
    const other = resolvePublicUserId(u);
    if (other === normalized) return true;
    // Also block against another account's raw username.
    const username = (u.username || '').trim().toLowerCase();
    return username === normalized;
  });
}

export type PublicUserIdAvailabilityStatus =
  | 'idle'
  | 'invalid'
  | 'checking'
  | 'available'
  | 'taken'
  | 'unreachable';

export function publicUserIdAvailabilityMessage(
  status: PublicUserIdAvailabilityStatus,
): string | null {
  switch (status) {
    case 'invalid':
      return null;
    case 'checking':
      return 'Checking if this User ID is available…';
    case 'available':
      return 'User ID is available.';
    case 'taken':
      return 'This User ID is already taken. Choose a different one.';
    case 'unreachable':
      return 'Could not verify User ID. Check your connection and try again.';
    default:
      return null;
  }
}
