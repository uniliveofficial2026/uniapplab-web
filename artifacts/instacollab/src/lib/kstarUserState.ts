import { db } from './db/localDb';
import { userHasProfilePremium } from './premium';
import type { User } from '../types';

const DB_KEY = 'karaoke_user_state';

type KstarUserRow = {
  coins: number;
  vip?: boolean;
};

type KstarUserStateStore = Record<string, KstarUserRow>;

export const DEMO_STARTER_COINS = 1250;

/** Local seed/demo accounts (`u1`, `u2`, …) — not Supabase UUIDs. */
export function isLegacyDemoUserId(userId: string): boolean {
  return /^u\d+$/i.test(userId?.trim() || '');
}

function readStore(): KstarUserStateStore {
  return db.load<KstarUserStateStore>(DB_KEY, {});
}

function writeStore(store: KstarUserStateStore): void {
  db.save(DB_KEY, store);
}

function defaultCoinsForUser(userId: string): number {
  if (isLegacyDemoUserId(userId)) return DEMO_STARTER_COINS;
  return 0;
}

function legacyGameCoinsBalance(): number {
  const raw = db.load('game_coins', null);
  if (!raw || typeof raw !== 'object') return 0;
  const inHouse = Number((raw as { in_house?: unknown }).in_house);
  return Number.isFinite(inHouse) && inHouse > 0 ? Math.floor(inHouse) : 0;
}

/** One-time migration from wallet `game_coins.in_house` into per-user K-Star balance. */
export function ensureKstarUserStateMigrated(userId: string): void {
  const id = userId?.trim();
  if (!id) return;
  const store = readStore();
  if (store[id]?.coins != null) return;

  const legacy = legacyGameCoinsBalance();
  const coins = legacy > 0 ? legacy : defaultCoinsForUser(id);
  writeStore({ ...store, [id]: { coins, vip: store[id]?.vip } });
}

/** Read-only row from `karaoke_user_state` — never writes (safe during React render). */
export function getKstarCoinsFromStore(userId: string): number {
  const id = userId?.trim();
  if (!id) return 0;
  const row = readStore()[id];
  if (row?.coins != null) return row.coins;
  return defaultCoinsForUser(id);
}

/** @deprecated Prefer `getLiveCoinsBalance` from `walletKstarSync` for UI. */
export function getKstarCoins(userId: string): number {
  return getKstarCoinsFromStore(userId);
}

export function setKstarCoins(userId: string, coins: number): void {
  const id = userId?.trim();
  if (!id) return;
  ensureKstarUserStateMigrated(id);
  const next = Math.max(0, Math.floor(coins));
  const store = { ...readStore() };
  const prev = store[id]?.coins;
  if (prev === next) return;
  store[id] = { ...store[id], coins: next };
  writeStore(store);
}

/** Low-level row update — prefer `walletKstarSync` add/spend for live balance changes. */
export function addKstarCoinsRow(userId: string, delta: number): number {
  const next = getKstarCoinsFromStore(userId) + delta;
  setKstarCoins(userId, next);
  return next;
}

/** Low-level row update — prefer `walletKstarSync.spendKstarCoins` for live spends. */
export function spendKstarCoinsRow(userId: string, amount: number): boolean {
  const cost = Math.max(0, Math.floor(amount));
  if (cost <= 0) return true;
  const current = getKstarCoinsFromStore(userId);
  if (current < cost) return false;
  setKstarCoins(userId, current - cost);
  return true;
}

export function isKstarVip(user: User | null | undefined): boolean {
  if (!user) return false;
  if (userHasProfilePremium(user)) return true;
  const row = readStore()[user.id];
  return Boolean(row?.vip);
}

export function setKstarVip(userId: string, vip: boolean): void {
  const id = userId?.trim();
  if (!id) return;
  const store = { ...readStore() };
  const existing = store[id];
  store[id] = {
    coins: existing?.coins ?? defaultCoinsForUser(id),
    vip,
  };
  writeStore(store);
}
