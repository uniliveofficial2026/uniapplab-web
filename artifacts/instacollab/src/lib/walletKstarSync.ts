import { isCloudAppStateRemoteApply } from './auth/cloudAppStateFlags';
import { isCloudAuthUserId } from './auth/cloudProfile';
import {
  ensureKstarUserStateMigrated,
  getKstarCoinsFromStore,
  setKstarCoins,
} from './kstarUserState';
import { db } from './db/localDb';
import { isSupabaseConfigured } from './supabase/config';

/**
 * Local coins_balance is a display cache only.
 * Server ledger (wallets + wallet_transactions via API/RPC) is authoritative.
 * Never treat local balance as the source of truth for financial settlement.
 */
export const DEFAULT_WALLET_COINS = 0;

/** Demo/local accounts may mutate a local display ledger. Cloud + API never may. */
export function isLocalWalletLedgerAllowed(userId?: string | null): boolean {
  const id = userId?.trim() || db.currentUserId?.trim() || '';
  if (!id) return false;
  if (isCloudAuthUserId(id) && isSupabaseConfigured()) return false;
  return true;
}

export function appendLocalWalletReceipt(row: Record<string, unknown>): void {
  if (!isLocalWalletLedgerAllowed()) return;
  const trans = db.load<unknown[]>('wallet_transactions', []);
  db.save('wallet_transactions', [row, ...trans]);
}

let listenersInstalled = false;

function activeWalletUserId(): string {
  return db.currentUserId?.trim() ?? '';
}

function isActiveWalletUser(userId: string): boolean {
  const id = userId?.trim();
  return Boolean(id && id === activeWalletUserId());
}

/** Read canonical wallet coins for the active session. */
export function loadWalletCoinsBalance(): number {
  return Number(db.load('coins_balance', DEFAULT_WALLET_COINS));
}

/** Live spendable coins — wallet for active user, per-user K-Star row otherwise. */
export function getLiveCoinsBalance(userId: string): number {
  const id = userId?.trim();
  if (!id) return 0;
  if (isActiveWalletUser(id)) {
    return loadWalletCoinsBalance();
  }
  return getKstarCoinsFromStore(id);
}

/** Keep wallet scalar and per-user K-Star row at the same absolute balance. */
function setUnifiedCoinsForUser(userId: string, nextBalance: number): void {
  const id = userId?.trim();
  if (!id) return;
  const next = Math.max(0, Math.floor(nextBalance));
  if (isActiveWalletUser(id)) {
    const wallet = loadWalletCoinsBalance();
    if (wallet !== next) {
      db.save('coins_balance', next);
    }
  }
  if (getKstarCoinsFromStore(id) !== next) {
    setKstarCoins(id, next);
  }
}

export function saveWalletCoinsBalance(userId: string, nextBalance: number): void {
  // Server/cache refresh only — allowed for cloud users.
  setUnifiedCoinsForUser(userId, nextBalance);
}

export function addWalletCoins(userId: string, amount: number): number {
  if (!isLocalWalletLedgerAllowed(userId)) {
    return getLiveCoinsBalance(userId);
  }
  const prev = getLiveCoinsBalance(userId);
  const next = prev + Math.max(0, Math.floor(amount));
  setUnifiedCoinsForUser(userId, next);
  return next;
}

/** Credit coins to any user (host payouts, commerce sales, etc.). */
export function creditUserCoins(userId: string, amount: number): number {
  return addWalletCoins(userId, amount);
}

export function spendWalletCoins(userId: string, amount: number): boolean {
  if (!isLocalWalletLedgerAllowed(userId)) {
    return false;
  }
  // Optimistic local debit for instant UI only. Server settlement must confirm financial truth.
  const cost = Math.max(0, Math.floor(amount));
  const prev = getLiveCoinsBalance(userId);
  if (prev < cost) return false;
  setUnifiedCoinsForUser(userId, prev - cost);
  if (import.meta.env.DEV) {
    console.info('[data:wallet] local_optimistic_debit', {
      userId: userId.slice(0, 8),
      cost,
      next: prev - cost,
    });
  }
  return true;
}

/** K-Star spends — same ledger as Wallet (`coins_balance`). */
export function spendKstarCoins(userId: string, amount: number): boolean {
  return spendWalletCoins(userId, amount);
}

/** K-Star grants — same ledger as Wallet. */
export function addKstarCoins(userId: string, amount: number): number {
  return addWalletCoins(userId, amount);
}

type GameCoinsRow = {
  pubg?: number;
  roblox?: number;
  mobile_legends?: number;
  in_house?: number;
  slot_game?: number;
};

/** Persist in-house game inventory only (not spendable wallet coins). */
export function saveGameInHouseCoins(_userId: string, nextInHouse: number): void {
  const raw = db.load<GameCoinsRow>('game_coins', {
    pubg: 0,
    roblox: 0,
    mobile_legends: 0,
    in_house: 0,
    slot_game: 0,
  });
  const next = Math.max(0, Math.floor(nextInHouse));
  db.save('game_coins', { ...raw, in_house: next });
}

/**
 * After login/account switch: align K-Star row to wallet cache for the active user.
 * Never inflate balance with Math.max — server refresh overwrites via saveWalletCoinsBalance.
 */
export function reconcileWalletAndKstarCoins(userId: string): void {
  const id = userId?.trim();
  if (!id || isCloudAppStateRemoteApply()) return;

  ensureKstarUserStateMigrated(id);
  if (!isActiveWalletUser(id)) return;

  const wallet = loadWalletCoinsBalance();
  const kstarRow = getKstarCoinsFromStore(id);
  // Keep rows equal using wallet cache as the display source; server sync replaces it.
  if (kstarRow !== wallet) {
    setKstarCoins(id, wallet);
  }
}

/**
 * Single entry point after any session becomes active (local demo, account switch, cloud hydrate).
 * Local/demo accounts reconcile immediately; cloud UUIDs reconcile after remote hydrate too.
 */
export function onUserSessionActive(userId: string): void {
  const id = userId?.trim();
  if (!id) return;
  reconcileWalletAndKstarCoins(id);
}

function scheduleReconcileForActiveUser(): void {
  const uid = activeWalletUserId();
  if (!uid) return;
  queueMicrotask(() => onUserSessionActive(uid));
}

/** Wire remote wallet / K-Star updates into a single balance. */
export function initWalletKstarSyncListeners(): void {
  if (listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = true;

  window.addEventListener('kstar-user-state-updated', scheduleReconcileForActiveUser);
  window.addEventListener('wallet-coins-updated', scheduleReconcileForActiveUser);

  // force_demo smoke seam only — never seeds cloud wallets.
  try {
    const forceDemo =
      new URLSearchParams(window.location.search).get('force_demo') === '1' ||
      sessionStorage.getItem('instacollab_demo_bootstrap_search')?.includes('force_demo=1');
    if (forceDemo) {
      const w = window as Window & {
        __UNI_DEMO_CREDIT_WALLET?: (coins?: number) => number;
      };
      w.__UNI_DEMO_CREDIT_WALLET = (coins = 50_000) => {
        const uid = activeWalletUserId();
        if (!uid || !isLocalWalletLedgerAllowed(uid)) return getLiveCoinsBalance(uid);
        return addWalletCoins(uid, Math.max(0, Math.floor(coins)));
      };
    }
  } catch {
    /* ignore */
  }
}

/** @deprecated — use onUserSessionActive */
export function scheduleLocalWalletSync(userId: string): void {
  onUserSessionActive(userId);
}
