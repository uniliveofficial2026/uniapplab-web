import type { User } from '../types';
import { stopCloudAppStateRealtime } from './auth/cloudAppState';
import { enableDevLocalAuthBypass } from './auth/devLocalAuth';
import { logDevActivity } from './devActivity';
import { db } from './db/localDb';
import { findUserById } from './safe';
import { isForceDemoSession, isUnifiedLiveMode } from './unifiedLive';

const DEVICE_USER_STORAGE_KEY = 'instacollab_dev_device_user';

/** Parse `?as=u2` or `?as=creative_sarah` from the URL. */
export function parseSessionUserFromSearch(search: string, users: User[]): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const raw = (params.get('as') || params.get('user') || params.get('login') || '').trim();
  if (!raw) return null;

  if (import.meta.env.DEV && /^u\d+$/.test(raw)) return raw;

  const byId = users.find((u) => u.id === raw);
  if (byId) return byId.id;

  const lower = raw.toLowerCase();
  const byName = users.find(
    (u) => u.username.toLowerCase() === lower || u.displayName.toLowerCase() === lower
  );
  return byName?.id ?? null;
}

/**
 * In dev, pick a distinct default account per host so localhost and a public tunnel
 * do not both land on u1 (needed for two-device DM / typing tests).
 */
export function resolveDevSessionUserId(hostname: string, search: string, users: User[]): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const fromUrl = parseSessionUserFromSearch(search, users);
  if (fromUrl) return fromUrl;

  const fallback = users[0]?.id ?? 'u1';
  if (!import.meta.env.DEV) return null;

  if (params.get('launch') !== 'main') return null;

  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return 'u1';
  if (host.endsWith('.trycloudflare.com') || host.includes('loca.lt')) return 'u2';
  if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return 'u3';

  try {
    const stored = sessionStorage.getItem(DEVICE_USER_STORAGE_KEY);
    if (stored && users.some((u) => u.id === stored)) return stored;
  } catch {
    /* ignore */
  }

  const assigned = users.find((u) => u.id === 'u2')?.id ?? users[1]?.id ?? fallback;
  try {
    sessionStorage.setItem(DEVICE_USER_STORAGE_KEY, assigned);
  } catch {
    /* ignore */
  }
  return assigned;
}

/** Apply dev account override only when skipping launch (?launch=main) or ?as= is set. */
export function shouldApplyDevSessionOverride(search: string): boolean {
  if (!import.meta.env.DEV) return false;
  if (isUnifiedLiveMode() && !isForceDemoSession(search)) return false;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (params.get('as') || params.get('user') || params.get('login')) return true;
  return params.get('launch') === 'main';
}

export function formatDevSessionUserHint(user: User | undefined): string {
  if (!user) return '';
  return `@${user.username} (${user.id})`;
}

/**
 * Dev-only: sign in as ?as=u1 (or host default), restore bundled demo content, skip cloud session apply.
 * Returns true when override ran.
 */
export async function applyDevSessionOverrideFromUrl(
  search = typeof window !== 'undefined' ? window.location.search : '',
  hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
): Promise<boolean> {
  if (!import.meta.env.DEV || !shouldApplyDevSessionOverride(search)) return false;

  logDevActivity('note', 'Dev session override starting');
  try {
    enableDevLocalAuthBypass();
    stopCloudAppStateRealtime();
    await db.whenStorageReady();

    const targetId = resolveDevSessionUserId(hostname, search, db.users);
    if (!targetId) {
      logDevActivity('note', 'Dev session override skipped (no target user)');
      return false;
    }

    if (targetId !== db.currentUserId) db.login(targetId);
    db.restoreLegacyDemoContentIfEmpty(targetId);
    await db.whenReady();
    if (Object.keys(db.stories).length === 0) {
      await db.applyDemoStoryStrip({ resetViews: false });
    }

    const progress = db.getLaunchProgress();
    if (!progress.hasSeenSplash) db.markSplashSeen();
    if (!progress.hasCompletedOnboarding) db.completeOnboarding();
    if (!progress.profileSetupComplete) db.completeProfileSetup();
    if (!progress.hasSeenTrending) db.markTrendingSeen();

    const user = findUserById(db.users, targetId);
    const fromUrl = parseSessionUserFromSearch(search, db.users);
    const detail = fromUrl
      ? `Dev: signed in as ${formatDevSessionUserHint(user)} (from URL)`
      : `Dev: signed in as ${formatDevSessionUserHint(user)} (?launch=main)`;
    window.dispatchEvent(new CustomEvent('app-toast', { detail }));
    logDevActivity(
      'note',
      `Dev session override done → ${targetId}, posts=${db.posts.length}, reels=${db.reels.length}, tasks=${db.tasks.length}, notifs=${db.notifications.length}`
    );

    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logDevActivity('note', `Dev session override failed: ${message}`);
    return false;
  }
}
