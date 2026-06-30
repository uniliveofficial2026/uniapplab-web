import { addKstarCoins, getKstarCoins, spendKstarCoins } from './kstarUserState';
import { db } from './db/localDb';

/** Keep K-Star coin balance in sync when the main Wallet changes `coins_balance`. */
export function mirrorWalletCoinsDelta(userId: string, delta: number): void {
  const id = userId?.trim();
  if (!id || !Number.isFinite(delta) || delta === 0) return;
  if (delta > 0) {
    addKstarCoins(id, Math.floor(delta));
  } else {
    spendKstarCoins(id, Math.floor(-delta));
  }
}

export function saveWalletCoinsBalance(userId: string, nextBalance: number): void {
  const prev = Number(db.load('coins_balance', 0));
  const next = Math.max(0, Math.floor(nextBalance));
  db.save('coins_balance', next);
  mirrorWalletCoinsDelta(userId, next - prev);
}

export function addWalletCoins(userId: string, amount: number): number {
  const prev = Number(db.load('coins_balance', 0));
  const next = prev + Math.max(0, Math.floor(amount));
  saveWalletCoinsBalance(userId, next);
  return next;
}

export function spendWalletCoins(userId: string, amount: number): boolean {
  const cost = Math.max(0, Math.floor(amount));
  const prev = Number(db.load('coins_balance', 0));
  if (prev < cost) return false;
  saveWalletCoinsBalance(userId, prev - cost);
  return true;
}

type GameCoinsRow = {
  pubg?: number;
  roblox?: number;
  mobile_legends?: number;
  in_house?: number;
  slot_game?: number;
};

/** Sync in-house game coin purchases into K-Star balance (live with Wallet). */
export function saveGameInHouseCoins(userId: string, nextInHouse: number): void {
  const raw = db.load<GameCoinsRow>('game_coins', {
    pubg: 0,
    roblox: 0,
    mobile_legends: 0,
    in_house: 0,
    slot_game: 0,
  });
  const prev = Number(raw.in_house) || 0;
  const next = Math.max(0, Math.floor(nextInHouse));
  db.save('game_coins', { ...raw, in_house: next });
  mirrorWalletCoinsDelta(userId, next - prev);
}

/** On login / cloud hydrate — align K-Star with wallet if wallet is ahead. */
export function reconcileWalletAndKstarCoins(userId: string): void {
  const id = userId?.trim();
  if (!id) return;
  const wallet = Number(db.load('coins_balance', 0));
  const inHouse = Number((db.load<GameCoinsRow>('game_coins', {}) as GameCoinsRow).in_house) || 0;
  const kstar = getKstarCoins(id);
  const target = Math.max(wallet, inHouse, kstar);
  if (target > kstar) {
    addKstarCoins(id, target - kstar);
  }
}
