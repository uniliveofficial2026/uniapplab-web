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
 * Default recharge packs — IDs must match `recharge_packages` rows (Stripe checkout).
 * Server SSOT: GET /api/payments/recharge/packages
 */
export const DEFAULT_RECHARGE_PACKS: CoinRechargePack[] = [
  {
    id: 'starter',
    title: 'Starter Bundle',
    coins: 500,
    bonusCoins: 0,
    priceUsd: 4.99,
    badge: 'Popular',
    isPopular: true,
  },
  {
    id: 'super',
    title: 'Super Pack',
    coins: 1000,
    bonusCoins: 200,
    priceUsd: 9.99,
    badge: 'Bonus +20%',
  },
  {
    id: 'elite',
    title: 'Elite Vault',
    coins: 2500,
    bonusCoins: 500,
    priceUsd: 24.99,
    badge: 'Best Value',
  },
  {
    id: 'whale',
    title: 'Whale Cache',
    coins: 5000,
    bonusCoins: 1500,
    priceUsd: 49.99,
    badge: 'Super Saver',
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
