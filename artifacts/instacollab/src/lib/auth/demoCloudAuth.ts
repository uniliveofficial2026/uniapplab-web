import { CLOUD_SYNC_COLLECTION_KEYS } from '../cloudSync/collectionKeys';
import { db } from '../db/localDb';
import { authSignInWithEmail, authSignUp } from './authService';
import { isCloudAuthConfigured, isSupabaseConfigured } from './config';
import { clearDevLocalAuthBypass } from './devLocalAuth';
import { isKnownLocalDemoEmail } from './localDemoAuth';
import { syncCloudSessionNow } from './syncSession';
import { flushCloudAppStateSync } from './cloudAppState';
import type { CloudSyncCollectionKey } from '../cloudSync/collectionKeys';

export const DEMO_PASSWORD = 'demo123';

type DemoAccountConfig = {
  legacyUserId: string;
  username: string;
  displayName: string;
};

const DEMO_ACCOUNTS: Record<string, DemoAccountConfig> = {
  'demo@instacollab.app': {
    legacyUserId: 'u1',
    username: 'designer_dude',
    displayName: 'Designer Dude',
  },
  'sarah@instacollab.app': {
    legacyUserId: 'u2',
    username: 'creative_sarah',
    displayName: 'Creative Sarah',
  },
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

/**
 * Sign in demo accounts through Supabase so wallet, K-Star, and feed sync like production.
 * Provisions the account on first login when missing from the cloud project.
 */
export async function signInDemoWithCloudSync(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const normalized = email.trim().toLowerCase();
  if (!isKnownLocalDemoEmail(normalized)) {
    return { ok: false, reason: 'Not a demo account.' };
  }
  if (!isCloudAuthConfigured()) {
    return { ok: false, reason: 'Cloud auth is not configured.' };
  }
  if (password !== DEMO_PASSWORD) {
    return {
      ok: false,
      reason: 'Demo password is demo123 for demo@instacollab.app and sarah@instacollab.app.',
    };
  }

  const config = DEMO_ACCOUNTS[normalized];
  stashLegacyDemoMigrationPayload(normalized);
  clearDevLocalAuthBypass();

  let authResult = await authSignInWithEmail(normalized, password);
  if (!authResult.ok && /incorrect email|invalid login/i.test(authResult.reason)) {
    const signUpResult = await authSignUp({
      email: normalized,
      password,
      username: config.username,
      displayName: config.displayName,
    });
    if (!signUpResult.ok) {
      return { ok: false, reason: signUpResult.reason };
    }
    if (signUpResult.needsEmailConfirmation) {
      return {
        ok: false,
        reason:
          'Demo account was created. Confirm the email in your inbox, or disable email confirmation for demo users in Supabase.',
      };
    }
  } else if (!authResult.ok) {
    return { ok: false, reason: authResult.reason };
  }

  const sync = await syncCloudSessionNow();
  if (!sync.ok) {
    return { ok: false, reason: sync.reason };
  }

  db.advanceLaunchProgressAfterLogin(true);
  const uid = db.currentUserId?.trim();
  if (uid) {
    const { onUserSessionActive } = await import('../walletKstarSync');
    onUserSessionActive(uid);
  }

  await flushCloudAppStateSync();
  return { ok: true };
}

/** Email for the active Supabase session (demo migration matching). */
export async function resolveDemoSessionEmail(userId: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { getSupabaseClient } = await import('../supabase/client');
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const sessionUser = data.session?.user;
  if (!sessionUser?.email || sessionUser.id !== userId) return null;
  return sessionUser.email.trim().toLowerCase();
}
