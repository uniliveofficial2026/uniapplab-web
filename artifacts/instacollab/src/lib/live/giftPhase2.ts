/**
 * Phase 2 gift feature scaffolds — combo meter, lucky rolls, PK scoring hooks.
 * Wired incrementally; catalog flags already exist on gift_catalog_items.
 */

import { COMBO_THRESHOLDS, comboLabelFromCount, type ComboLabel } from './giftEconomy';

export type LuckyRewardKind = 'coins' | 'bonus_coins' | 'vip_badge' | 'gift' | 'avatar_frame';

export type LuckyReward = {
  kind: LuckyRewardKind;
  amount?: number;
  label: string;
  weight: number;
};

/** Default treasure-box weight table (server should own the real roll). */
export const DEFAULT_LUCKY_REWARDS: LuckyReward[] = [
  { kind: 'coins', amount: 5, label: '5 Coins', weight: 40 },
  { kind: 'coins', amount: 50, label: '50 Coins', weight: 30 },
  { kind: 'coins', amount: 500, label: '500 Coins', weight: 15 },
  { kind: 'vip_badge', label: 'VIP Badge', weight: 8 },
  { kind: 'gift', label: 'Special Gift', weight: 5 },
  { kind: 'avatar_frame', label: 'Limited Avatar Frame', weight: 2 },
];

export function rollLuckyReward(
  table: LuckyReward[] = DEFAULT_LUCKY_REWARDS,
  rng: () => number = Math.random,
): LuckyReward {
  const total = table.reduce((sum, row) => sum + row.weight, 0);
  let cursor = rng() * total;
  for (const row of table) {
    cursor -= row.weight;
    if (cursor <= 0) return row;
  }
  return table[table.length - 1];
}

export type ComboMeterState = {
  giftId: string;
  count: number;
  label: ComboLabel;
  nextThreshold: number | null;
};

export function buildComboMeter(giftId: string, count: number): ComboMeterState {
  const next = COMBO_THRESHOLDS.find((n) => n > count) ?? null;
  return {
    giftId,
    count,
    label: comboLabelFromCount(count),
    nextThreshold: next,
  };
}

export type PkGiftScoreDelta = {
  team: 'a' | 'b';
  delta: number;
  multiplier: number;
};

/** PK gift score: base coin value × team combo multiplier. */
export function pkScoreFromGift(unitPrice: number, quantity: number, teamCombo = 1): number {
  return Math.max(0, Math.floor(unitPrice * quantity * Math.max(1, teamCombo)));
}
