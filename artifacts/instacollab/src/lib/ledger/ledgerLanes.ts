/**
 * UniLive Stage A — marketplace/seller/orders vs gift wallet lane separation.
 *
 * Gift wallet lane: spendable coins + gift diamonds + gift_transactions.
 * Commerce/seller lane: orders store + cash_balance + host earnings (cash/coin).
 *
 * Cross-lane contamination is forbidden:
 * - Commerce seller payouts must not credit gift-wallet spendable coins / diamonds.
 * - Gift settle must not write commerce orders or commerce host earnings.
 * - Gift receive (local demo) credits diamonds, never spendable coins.
 */

import { db } from '../db/localDb';

export const GIFT_WALLET_STORAGE_KEYS = [
  'coins_balance',
  'diamonds_balance',
  'wallet_transactions',
] as const;

export const COMMERCE_SELLER_STORAGE_KEYS = [
  'unilive.commerce.orders.v1',
  'cash_balance',
  'commerce_host_earnings',
  'commerce_host_coin_earnings',
] as const;

export const GIFT_FIRESTORE_COLLECTIONS = ['wallets', 'gift_transactions', 'gift_room_stats'] as const;

type HostCoinEarnings = Record<string, number>;

/** Local gift-receive diamonds (display cache for demo ledger only). */
export function creditLocalGiftDiamonds(userId: string, amount: number): number {
  const id = userId?.trim();
  const delta = Math.max(0, Math.floor(amount));
  if (!id || delta <= 0) return 0;
  if (id !== db.currentUserId?.trim()) {
    // Non-active receivers: keep out of active gift spendable coins.
    return 0;
  }
  const prev = Math.max(0, Math.floor(Number(db.load('diamonds_balance', 0))));
  const next = prev + delta;
  db.save('diamonds_balance', next);
  return next;
}

export function getLocalGiftDiamonds(userId?: string | null): number {
  const id = userId?.trim() || db.currentUserId?.trim() || '';
  if (!id || id !== db.currentUserId?.trim()) return 0;
  return Math.max(0, Math.floor(Number(db.load('diamonds_balance', 0))));
}

/** Seller coin earnings from marketplace/shop-live — never coins_balance. */
export function creditHostCommerceCoinEarnings(hostUserId: string, amount: number): void {
  const hostId = hostUserId?.trim();
  const coins = Math.max(0, Math.floor(amount));
  if (!hostId || coins <= 0) return;

  const earnings = db.load<HostCoinEarnings>('commerce_host_coin_earnings', {});
  earnings[hostId] = (earnings[hostId] ?? 0) + coins;
  db.save('commerce_host_coin_earnings', earnings);
}

export function getHostCommerceCoinEarnings(hostUserId: string): number {
  const hostId = hostUserId?.trim();
  if (!hostId) return 0;
  const earnings = db.load<HostCoinEarnings>('commerce_host_coin_earnings', {});
  return Math.max(0, Math.floor(Number(earnings[hostId] ?? 0)));
}

/** Runtime guard helpers for contract tests / audits. */
export function commerceMustNotTouchGiftWalletCollections(): readonly string[] {
  return GIFT_FIRESTORE_COLLECTIONS;
}

export function giftSettleMustNotTouchCommerceKeys(): readonly string[] {
  return COMMERCE_SELLER_STORAGE_KEYS;
}
