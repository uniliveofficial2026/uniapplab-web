import { db } from './db/localDb';
import { isCloudAuthUserId } from './auth/cloudProfile';
import { fetchWallet, fetchMe, isPlatformApiAvailable } from './platformApi';
import { saveWalletCoinsBalance } from './walletKstarSync';
import { getKstarCoinsFromStore } from './kstarUserState';

let meCache: Awaited<ReturnType<typeof fetchMe>> | null = null;

export function getCachedPlatformMe() {
  return meCache;
}

export async function hydratePlatformSession(userId: string): Promise<void> {
  if (!isPlatformApiAvailable() || !isCloudAuthUserId(userId)) return;
  try {
    meCache = await fetchMe();
    const me = db.currentUser;
    if (!me || me.id !== userId) return;

    const nextBannedAt = meCache.bannedAt ? Date.parse(meCache.bannedAt) : undefined;
    const nextMutedUntil = meCache.mutedUntil ? Date.parse(meCache.mutedUntil) : undefined;
    const role = meCache.role ?? 'user';
    const unchanged =
      me.role === role &&
      me.bannedAt === nextBannedAt &&
      (me.banReason ?? undefined) === (meCache.banReason ?? undefined) &&
      me.mutedUntil === nextMutedUntil;
    if (unchanged) return;

    db.syncAuthUser({
      ...me,
      role,
      bannedAt: nextBannedAt,
      banReason: meCache.banReason ?? undefined,
      mutedUntil: nextMutedUntil,
    });
  } catch {
    // API may be unavailable in local-only dev
  }
}

export async function syncServerWalletBalance(userId: string): Promise<void> {
  if (!isPlatformApiAvailable() || !isCloudAuthUserId(userId)) return;
  if (db.currentUserId !== userId) return;
  try {
    const { balance } = await fetchWallet();
    if (typeof balance !== 'number' || !Number.isFinite(balance)) return;
    const server = Math.floor(balance);
    const local = Math.floor(Number(db.load('coins_balance', 0)));
    const kstar = getKstarCoinsFromStore(userId);
    const canonical = Math.max(server, local, kstar);
    if (canonical === local) return;
    saveWalletCoinsBalance(userId, canonical);
    window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
  } catch {
    // fall back to local ledger
  }
}
