import { isCloudAppStateRemoteApply } from './auth/cloudAppStateFlags';
import {
  ensureKstarUserStateMigrated,
  getKstarCoinsFromStore,
  setKstarCoins,
} from './kstarUserState';
import { db } from './db/localDb';

/** Shared default when `coins_balance` has never been persisted. */
export const DEFAULT_WALLET_COINS = 0;

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
  setUnifiedCoinsForUser(userId, nextBalance);
}

export function addWalletCoins(userId: string, amount: number): number {
  const prev = loadWalletCoinsBalance();
  const next = prev + Math.max(0, Math.floor(amount));
  setUnifiedCoinsForUser(userId, next);
  return next;
}

export function spendWalletCoins(userId: string, amount: number): boolean {
  const cost = Math.max(0, Math.floor(amount));
  const prev = loadWalletCoinsBalance();
  if (prev < cost) return false;
  setUnifiedCoinsForUser(userId, prev - cost);
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
 * After login, account switch, or cloud hydrate — merge wallet + K-Star row once.
 * Uses max() only to heal drift; never inflates above the higher of the two stores.
 */
export function reconcileWalletAndKstarCoins(userId: string): void {
  const id = userId?.trim();
  if (!id || isCloudAppStateRemoteApply()) return;

  ensureKstarUserStateMigrated(id);
  if (!isActiveWalletUser(id)) return;

  const wallet = loadWalletCoinsBalance();
  const kstarRow = getKstarCoinsFromStore(id);
  const canonical = Math.max(wallet, kstarRow);
  if (canonical !== wallet || canonical !== kstarRow) {
    setUnifiedCoinsForUser(id, canonical);
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
}

/** @deprecated — use onUserSessionActive */
export function scheduleLocalWalletSync(userId: string): void {
  onUserSessionActive(userId);
}
