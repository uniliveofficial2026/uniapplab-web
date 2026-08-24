import { apiFetch } from '../platformApi';
import type { ServiceResult } from '../../types/platform';
import { resolveUserDecorations, type UserDecorations } from '../entitlements/userDecorations';

export type ServerEntitlement = {
  id: string;
  user_id: string;
  entitlement_type: string;
  entitlement_id: string;
  scope?: string;
  scope_id?: string | null;
  status: string;
  starts_at?: string;
  expires_at?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
};

const cacheByUser = new Map<string, { at: number; entitlements: ServerEntitlement[] }>();
const CACHE_TTL_MS = 30_000;

function toDecorationBucket(rows: ServerEntitlement[]): Record<string, unknown> {
  const bucket: Record<string, unknown> = {};
  const now = Date.now();
  for (const row of rows) {
    if (row.status !== 'active') continue;
    if (row.expires_at && Date.parse(row.expires_at) <= now) continue;
    bucket[row.entitlement_type] = row.entitlement_id || true;
    if (row.entitlement_type === 'vip' || row.entitlement_type === 'svip') {
      bucket[row.entitlement_type] = true;
    }
    if (row.entitlement_type.endsWith('_frame') || row.entitlement_type.includes('frame')) {
      bucket[row.entitlement_type] = row.entitlement_id;
    }
  }
  return bucket;
}

export async function fetchUserEntitlements(
  userId: string,
): Promise<ServiceResult<{ entitlements: ServerEntitlement[] }>> {
  const id = userId.trim();
  if (!id) return { ok: false, error: 'userId required' };
  const cached = cacheByUser.get(id);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { ok: true, data: { entitlements: cached.entitlements } };
  }
  try {
    const data = await apiFetch<{ userId: string; entitlements: ServerEntitlement[] }>(
      `/api/entitlements/${encodeURIComponent(id)}`,
    );
    const entitlements = Array.isArray(data.entitlements) ? data.entitlements : [];
    cacheByUser.set(id, { at: Date.now(), entitlements });
    return { ok: true, data: { entitlements } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function invalidateEntitlementCache(userId?: string): void {
  if (!userId) {
    cacheByUser.clear();
    return;
  }
  cacheByUser.delete(userId);
}

export async function resolveDecorationsForUser(
  userId: string,
  extras?: {
    roomId?: string;
    liveSession?: { host_user_id?: string | null } | null;
    seats?: Array<{ user_id?: string | null; seat_index?: number }> | null;
  },
): Promise<UserDecorations> {
  const result = await fetchUserEntitlements(userId);
  const rows = result.ok ? result.data.entitlements : [];
  return resolveUserDecorations({
    userId,
    roomId: extras?.roomId,
    liveSession: extras?.liveSession,
    seats: extras?.seats,
    entitlements: { [userId]: toDecorationBucket(rows) },
  });
}
