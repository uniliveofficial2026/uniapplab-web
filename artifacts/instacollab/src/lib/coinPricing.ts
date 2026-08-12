/**
 * UniLive’s coin pricing — single source of truth for all screens.
 * Reference prize: 100 coins for $10.00 USD.
 */

/** Canonical pack: 100 coins ↔ $10 USD. */
export const COIN_REFERENCE_COINS = 100;
export const COIN_REFERENCE_USD = 10;

/** How many coins $1 USD buys (100 coins / $10). */
export const COINS_PER_USD = COIN_REFERENCE_COINS / COIN_REFERENCE_USD; // 10

/** USD price of one coin ($10 / 100). */
export const USD_PER_COIN = COIN_REFERENCE_USD / COIN_REFERENCE_COINS; // 0.10

/** Exchange fee when converting coins → cash (1%). */
export const COIN_TO_CASH_FEE = 0.01;

export function coinsFromUsd(usd: number): number {
  return Math.floor(Math.max(0, usd) * COINS_PER_USD);
}

export function usdFromCoins(coins: number, applyCashOutFee = false): number {
  const gross = Math.max(0, coins) * USD_PER_COIN;
  if (!applyCashOutFee) return Math.round(gross * 100) / 100;
  return Math.round(gross * (1 - COIN_TO_CASH_FEE) * 100) / 100;
}

export function usdPriceForCoins(coins: number): number {
  return Math.max(USD_PER_COIN, Math.round(coins * USD_PER_COIN * 100) / 100);
}

export const COIN_RATE_LABEL = `${COIN_REFERENCE_COINS} Coins = $${COIN_REFERENCE_USD.toFixed(2)} USD`;

export type CoinRechargePack = {
  id: string;
  title: string;
  coins: number;
  bonusCoins: number;
  /** USD dollars (not cents). */
  priceUsd: number;
  badge?: string;
  isPopular?: boolean;
};

/**
 * Default recharge packs — all priced at the 100 coins / $10 rate (no bonus dilution).
 * Flagship “All Coins” pack is exactly 100 for $10.
 */
export const DEFAULT_RECHARGE_PACKS: CoinRechargePack[] = [
  {
    id: 'starter',
    title: 'Starter Bundle',
    coins: 50,
    bonusCoins: 0,
    priceUsd: 5,
  },
  {
    id: 'all_coins',
    title: 'All Coins',
    coins: COIN_REFERENCE_COINS,
    bonusCoins: 0,
    priceUsd: COIN_REFERENCE_USD,
    badge: 'Popular',
    isPopular: true,
  },
  {
    id: 'plus',
    title: 'Plus Pack',
    coins: 250,
    bonusCoins: 0,
    priceUsd: 25,
  },
  {
    id: 'pro',
    title: 'Pro Vault',
    coins: 500,
    bonusCoins: 0,
    priceUsd: 50,
    badge: 'Best Value',
  },
  {
    id: 'mega',
    title: 'Mega Cache',
    coins: 1000,
    bonusCoins: 0,
    priceUsd: 100,
  },
];

/** Alias used by live gift recharge UI (priceUsd field). */
export const RECHARGE_PACKAGES_FALLBACK = DEFAULT_RECHARGE_PACKS.map((p) => ({
  id: p.id,
  coins: p.coins,
  priceUsd: p.priceUsd,
  bonusCoins: p.bonusCoins,
  isPopular: p.isPopular,
}));
