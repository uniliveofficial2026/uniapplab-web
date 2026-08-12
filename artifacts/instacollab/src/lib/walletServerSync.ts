import { db } from './db/localDb';
import { isCloudAuthUserId } from './auth/cloudProfile';
import { shouldUseFirebaseForCloudData } from './auth/cloudDataBackend';
import { fetchWallet, fetchMe, isPlatformApiAvailable } from './platformApi';
import { isFirebaseConfigured } from './firebase/config';
import { saveWalletCoinsBalance } from './walletKstarSync';

async function firebaseGiftWallet() {
  return import('./firebase/giftWallet');
}

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

async function fetchFirebaseWalletBalance(userId: string): Promise<number | null> {
  if (!isFirebaseConfigured()) return null;
  const fb = await firebaseGiftWallet();
  if (!fb.isFirebaseGiftWalletAvailable()) return null;
  const wallet = await fb.fetchFirebaseWallet(userId);
  return Math.floor(wallet.balance);
}

export async function syncServerWalletBalance(userId: string): Promise<void> {
  if (!isCloudAuthUserId(userId)) return;
  if (db.currentUserId !== userId) return;

  const preferFirebase = shouldUseFirebaseForCloudData(userId);

  if (preferFirebase && isFirebaseConfigured()) {
    try {
      const server = await fetchFirebaseWalletBalance(userId);
      if (server === null) throw new Error('Firebase wallet unavailable');
      const local = Math.floor(Number(db.load('coins_balance', 0)));
      if (server !== local) {
        saveWalletCoinsBalance(userId, server);
        window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
      }
      return;
    } catch {
      /* try API */
    }
  }

  if (!isPlatformApiAvailable()) {
    if (isFirebaseConfigured()) {
      try {
        const server = await fetchFirebaseWalletBalance(userId);
        if (server !== null) {
          saveWalletCoinsBalance(userId, server);
          window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
        }
      } catch {
        /* local ledger */
      }
    }
    return;
  }

  try {
    const { balance } = await fetchWallet();
    if (typeof balance !== 'number' || !Number.isFinite(balance)) return;
    const server = Math.floor(balance);
    const local = Math.floor(Number(db.load('coins_balance', 0)));
    // Cloud ledger is authoritative — never keep inflated local/K-Star balances.
    if (server !== local) {
      saveWalletCoinsBalance(userId, server);
      window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
    }
  } catch {
    if (isFirebaseConfigured()) {
      try {
        const server = await fetchFirebaseWalletBalance(userId);
        if (server !== null) {
          saveWalletCoinsBalance(userId, server);
          window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
        }
      } catch {
        // fall back to local ledger
      }
    }
  }
}
