import { isCloudAuthConfigured } from './auth/config';
import { db } from './db/localDb';
import { userHasProfilePremium } from './premium';
import type { User } from '../types';

const DB_KEY = 'karaoke_user_state';

type KstarUserRow = {
  coins: number;
  vip?: boolean;
};

type KstarUserStateStore = Record<string, KstarUserRow>;

const DEMO_DEFAULT_COINS = 1250;

function readStore(): KstarUserStateStore {
  return db.load<KstarUserStateStore>(DB_KEY, {});
}

function writeStore(store: KstarUserStateStore): void {
  db.save(DB_KEY, store);
}

function defaultCoinsForUser(userId: string): number {
  if (!isCloudAuthConfigured() && userId === 'u1') return DEMO_DEFAULT_COINS;
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

export function getKstarCoins(userId: string): number {
  const id = userId?.trim();
  if (!id) return 0;
  ensureKstarUserStateMigrated(id);
  return readStore()[id]?.coins ?? defaultCoinsForUser(id);
}

export function setKstarCoins(userId: string, coins: number): void {
  const id = userId?.trim();
  if (!id) return;
  const store = { ...readStore() };
  store[id] = { ...store[id], coins: Math.max(0, Math.floor(coins)) };
  writeStore(store);
}

export function addKstarCoins(userId: string, delta: number): number {
  const next = getKstarCoins(userId) + delta;
  setKstarCoins(userId, next);
  return next;
}

export function spendKstarCoins(userId: string, amount: number): boolean {
  const cost = Math.max(0, Math.floor(amount));
  if (cost <= 0) return true;
  const current = getKstarCoins(userId);
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
  store[id] = {
    coins: store[id]?.coins ?? getKstarCoins(id),
    vip,
  };
  writeStore(store);
}
