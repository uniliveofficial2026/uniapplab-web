/** Phase 1–4 gift economy shared types (client). */

export type WalletCurrency =
  | 'coins'
  | 'diamonds'
  | 'reward_points'
  | 'bonus_coins'
  | 'promo_credits'
  | 'vip_tokens';

export type GiftCatalogItem = {
  id: string;
  name: string;
  description?: string;
  price: number;
  /** Legacy alias for price in coins. */
  stars: number;
  currency: WalletCurrency | string;
  category?: string;
  tier?: string;
  rarity?: string;
  animation?: string | null;
  preview?: string | null;
  sound?: string | null;
  icon: string;
  effectSvgaUrl?: string | null;
  effectVideoUrl?: string | null;
  comboEnabled?: boolean;
  vipOnly?: boolean;
  seasonal?: boolean;
  lucky?: boolean;
  blindBox?: boolean;
  pkEnabled?: boolean;
  availableFrom?: string | null;
  availableUntil?: string | null;
  status?: string;
};

export type GiftSendEvent = {
  giftId: string;
  senderId: string;
  receiverId: string;
  roomId: string | null;
  quantity: number;
  combo: number;
  timestamp: number;
  totalCoins?: number;
  tier?: string;
  giftTransactionId?: string;
};

export type WalletBalances = {
  balance: number;
  coins: number;
  diamonds: number;
  rewardPoints: number;
  bonusCoins: number;
  promoCredits: number;
  vipTokens: number;
  limits?: {
    dailyCoinLimit: number;
    monthlyCoinLimit: number;
    dailySpent: number;
    monthlySpent: number;
  } | null;
  transactions?: unknown[];
};

export type RechargePackage = {
  id: string;
  title: string;
  coins: number;
  bonusCoins: number;
  priceUsdCents: number;
  badge?: string | null;
  providers?: string[];
};

/** Phase 2 combo thresholds (UI meter). */
export const COMBO_THRESHOLDS = [1, 5, 10, 20, 50, 99, 100, 999] as const;

export type ComboLabel =
  | 'none'
  | 'small'
  | 'golden'
  | 'mega'
  | 'legendary';

export function comboLabelFromCount(count: number): ComboLabel {
  if (count >= 999) return 'legendary';
  if (count >= 100) return 'mega';
  if (count >= 50) return 'golden';
  if (count >= 10) return 'small';
  return 'none';
}

/** Phase 2 animation queue priority (higher = sooner). */
export const GIFT_QUEUE_PRIORITY: Record<string, number> = {
  mythic: 100,
  legendary: 80,
  epic: 60,
  premium: 40,
  normal: 20,
};

export const MAX_SIMULTANEOUS_GIFT_ANIMATIONS = 3;
