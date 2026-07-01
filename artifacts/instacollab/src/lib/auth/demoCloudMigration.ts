import { CLOUD_SYNC_COLLECTION_KEYS, type CloudSyncCollectionKey } from '../cloudSync/collectionKeys';
import { db } from '../db/localDb';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/config';

type DemoAccountConfig = {
  legacyUserId: string;
};

const DEMO_ACCOUNTS: Record<string, DemoAccountConfig> = {
  'demo@instacollab.app': { legacyUserId: 'u1' },
  'sarah@instacollab.app': { legacyUserId: 'u2' },
};

const PENDING_MIGRATION_KEY = 'instacollab_pending_demo_cloud_migration';

export type PendingDemoMigration = {
  email: string;
  legacyUserId: string;
  collections: Partial<Record<CloudSyncCollectionKey, unknown>>;
  updatedAt: number;
};

export function getLegacyDemoUserId(email: string): string | null {
  const config = DEMO_ACCOUNTS[email.trim().toLowerCase()];
  return config?.legacyUserId ?? null;
}

function collectLegacyDemoCollections(legacyUserId: string): Partial<Record<CloudSyncCollectionKey, unknown>> {
  db.ensureDemoAuthAccounts();
  const snapshots =
    db.load<Record<string, Record<string, unknown>>>('account_local_snapshots', {}) || {};
  const fromSnapshot = snapshots[legacyUserId];
  if (fromSnapshot && typeof fromSnapshot === 'object') {
    return fromSnapshot as Partial<Record<CloudSyncCollectionKey, unknown>>;
  }

  const collections: Partial<Record<CloudSyncCollectionKey, unknown>> = {};
  for (const key of CLOUD_SYNC_COLLECTION_KEYS) {
    const value = (db as unknown as { cache: Record<string, unknown> }).cache[key];
    if (value !== undefined) {
      collections[key] = value;
      continue;
    }
    try {
      const loaded = db.load(key, undefined as unknown);
      if (loaded !== undefined) collections[key] = loaded;
    } catch {
      /* optional key */
    }
  }
  return collections;
}

/** Stash local demo IDB data before cloud session replaces the active user id. */
export function stashLegacyDemoMigrationPayload(email: string): void {
  const normalized = email.trim().toLowerCase();
  const config = DEMO_ACCOUNTS[normalized];
  if (!config || typeof sessionStorage === 'undefined') return;

  const collections = collectLegacyDemoCollections(config.legacyUserId);
  const payload: PendingDemoMigration = {
    email: normalized,
    legacyUserId: config.legacyUserId,
    collections,
    updatedAt: Date.now(),
  };

  try {
    sessionStorage.setItem(PENDING_MIGRATION_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function peekPendingDemoMigration(email: string): PendingDemoMigration | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_MIGRATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingDemoMigration;
    if (parsed?.email !== email.trim().toLowerCase()) return null;
    if (!parsed.collections || typeof parsed.updatedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function consumePendingDemoMigration(email: string): PendingDemoMigration | null {
  const pending = peekPendingDemoMigration(email);
  if (!pending) return null;
  try {
    sessionStorage.removeItem(PENDING_MIGRATION_KEY);
  } catch {
    /* ignore */
  }
  return pending;
}

/** Email for the active Supabase session (demo migration matching). */
export async function resolveDemoSessionEmail(userId: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const sessionUser = data.session?.user;
  if (!sessionUser?.email || sessionUser.id !== userId) return null;
  return sessionUser.email.trim().toLowerCase();
}
