import { db } from '../db/localDb';
import { scheduleLiveSessionSync } from '../liveSessionSync';
import { authSignInWithEmail, authSignUp } from './authService';
import { isCloudAuthConfigured } from './config';
import { clearDevLocalAuthBypass } from './devLocalAuth';
import { stashLegacyDemoMigrationPayload } from './demoCloudMigration';
import { isKnownLocalDemoEmail } from './localDemoAuth';
import { syncCloudSessionNow } from './syncSession';
import { flushCloudAppStateSync } from './cloudAppState';

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

export { getLegacyDemoUserId, type PendingDemoMigration } from './demoCloudMigration';

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
    scheduleLiveSessionSync(uid);
  }

  await flushCloudAppStateSync();
  return { ok: true };
}
