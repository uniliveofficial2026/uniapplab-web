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
  exceptAuthId?: string
): boolean {
  const normalized = normalizePublicUserId(publicUserId);
  return !users.some((u) => {
    if (exceptAuthId && u.id === exceptAuthId) return false;
    const other = resolvePublicUserId(u);
    return other === normalized;
  });
}
