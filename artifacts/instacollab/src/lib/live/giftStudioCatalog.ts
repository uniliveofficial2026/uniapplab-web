import { giftTierFromStars } from './giftTiers';
import type { GiftEffectDefinition } from './giftEffectCatalogTypes';

export type GiftSeason = 'Christmas' | 'Lunar New Year' | 'Valentine' | 'Halloween';

export type StudioGiftMeta = {
  isSeasonal?: boolean;
  season?: GiftSeason;
  isVipExclusive?: boolean;
  description?: string;
};

/** Extra live-gift-studio catalog entries (merged on top of builtin SVGA gifts). */
const STUDIO_EXTRA_GIFTS: Array<GiftEffectDefinition & StudioGiftMeta> = [
  // Normal
  { id: 'coffee', name: 'Coffee', icon: '☕', stars: 10, tier: giftTierFromStars(10), particleColor: '#c4a484', description: 'Keep the streamer warm and awake' },
  { id: 'cake', name: 'Cake', icon: '🎂', stars: 20, tier: giftTierFromStars(20), particleColor: '#f9a8d4', description: 'Sweet birthday or party cake' },
  { id: 'teddy_bear', name: 'Teddy Bear', icon: '🧸', stars: 25, tier: giftTierFromStars(25), particleColor: '#fdba74', description: 'A cute cuddly bear' },
  { id: 'chocolate', name: 'Chocolate', icon: '🍫', stars: 15, tier: giftTierFromStars(15), particleColor: '#92400e', description: 'Indulge in sweet chocolate' },
  { id: 'flower_bouquet', name: 'Flower Bouquet', icon: '🌸', stars: 50, tier: giftTierFromStars(50), particleColor: '#f9a8d4', description: 'A beautiful fresh bouquet' },
  { id: 'balloon', name: 'Balloon', icon: '🎈', stars: 8, tier: giftTierFromStars(8), particleColor: '#fb7185', description: 'Fly high with love' },
  { id: 'lucky_clover', name: 'Lucky Clover', icon: '🍀', stars: 1, tier: giftTierFromStars(1), particleColor: '#4ade80', description: 'Wish them best of luck' },
  { id: 'kiss', name: 'Kiss', icon: '💋', stars: 30, tier: giftTierFromStars(30), particleColor: '#f43f5e', description: 'A virtual warm kiss' },

  // Premium
  { id: 'royal_crown', name: 'Royal Crown', icon: '👑', stars: 120, tier: giftTierFromStars(120), effectSvgaUrl: '/live-gifts/crown.svga', particleColor: '#fcd34d', description: 'Crown the streamer' },
  { id: 'diamond_ring', name: 'Diamond Ring', icon: '💍', stars: 250, tier: giftTierFromStars(250), particleColor: '#67e8f9', description: 'Propose your love' },
  { id: 'super_car', name: 'Super Car', icon: '🚗', stars: 500, tier: giftTierFromStars(500), particleColor: '#60a5fa', description: 'Zoom on the fast lane' },
  { id: 'crystal_diamond', name: 'Crystal Diamond', icon: '💎', stars: 300, tier: giftTierFromStars(300), effectSvgaUrl: '/live-gifts/crown.svga', particleColor: '#67e8f9', description: 'Pure luxury diamond' },
  { id: 'champagne', name: 'Champagne', icon: '🍾', stars: 150, tier: giftTierFromStars(150), particleColor: '#fde68a', description: 'Let the bottles pop' },
  { id: 'treasure_chest', name: 'Treasure Chest', icon: '🎁', stars: 450, tier: giftTierFromStars(450), particleColor: '#fbbf24', description: 'Unlock secret rewards' },
  { id: 'luxury_bag', name: 'Luxury Bag', icon: '👜', stars: 600, tier: giftTierFromStars(600), particleColor: '#f9a8d4', description: 'Designer style piece' },
  { id: 'luxury_watch', name: 'Luxury Watch', icon: '⌚', stars: 750, tier: giftTierFromStars(750), particleColor: '#a3a3a3', description: 'Time is gold' },
  { id: 'yacht', name: 'Yacht', icon: '🛥', stars: 850, tier: giftTierFromStars(850), particleColor: '#38bdf8', description: 'Sail in deep blue seas' },
  { id: 'private_jet', name: 'Private Jet', icon: '✈', stars: 999, tier: giftTierFromStars(999), particleColor: '#94a3b8', description: 'Travel first class' },

  // Epic
  { id: 'golden_dragon', name: 'Golden Dragon', icon: '🐉', stars: 1200, tier: giftTierFromStars(1200), effectSvgaUrl: '/live-gifts/rocket.svga', particleColor: '#f59e0b', description: 'Roaring ancient dragon power' },
  { id: 'studio_phoenix', name: 'Phoenix', icon: '🦅', stars: 1800, tier: giftTierFromStars(1800), effectSvgaUrl: '/live-gifts/rocket.svga', particleColor: '#fb923c', description: 'Rising from the fire' },
  { id: 'crystal_castle', name: 'Crystal Castle', icon: '🏰', stars: 2500, tier: giftTierFromStars(2500), effectSvgaUrl: '/live-gifts/rocket.svga', particleColor: '#c4b5fd', description: 'A fortress of light' },
  { id: 'galaxy_portal', name: 'Galaxy Portal', icon: '🌀', stars: 3000, tier: giftTierFromStars(3000), effectSvgaUrl: '/live-gifts/star.svga', particleColor: '#818cf8', description: 'Teleport through wormholes' },
  { id: 'flying_unicorn', name: 'Flying Unicorn', icon: '🦄', stars: 3500, tier: giftTierFromStars(3500), effectSvgaUrl: '/live-gifts/crown.svga', particleColor: '#e879f9', description: 'Legendary magical unicorn' },
  { id: 'star_whale', name: 'Star Whale', icon: '🐳', stars: 4500, tier: giftTierFromStars(4500), particleColor: '#22d3ee', description: 'Celestial deep space whale' },
  { id: 'ice_queen', name: 'Ice Queen', icon: '❄️', stars: 5500, tier: giftTierFromStars(5500), particleColor: '#bae6fd', description: 'Glacial frost queen avatar' },
  { id: 'magic_tree', name: 'Magic Tree', icon: '🌳', stars: 6000, tier: giftTierFromStars(6000), particleColor: '#86efac', description: 'Abundant tree of life' },
  { id: 'rainbow_pegasus', name: 'Rainbow Pegasus', icon: '🎠', stars: 7000, tier: giftTierFromStars(7000), particleColor: '#f0abfc', description: 'Soar in neon rainbow skies' },
  { id: 'space_rocket', name: 'Space Rocket', icon: '🚀', stars: 9999, tier: giftTierFromStars(9999), effectSvgaUrl: '/live-gifts/rocket.svga', particleColor: '#60a5fa', description: 'To the moon and beyond' },

  // Legendary
  { id: 'golden_palace', name: 'Golden Palace', icon: '🏛', stars: 12000, tier: giftTierFromStars(12000), particleColor: '#fbbf24', description: 'Royal palace of supreme luxury' },
  { id: 'lion_king', name: 'Lion King', icon: '🦁', stars: 15000, tier: giftTierFromStars(15000), particleColor: '#f59e0b', description: 'King of the jungle salute' },
  { id: 'titan_robot', name: 'Titan Robot', icon: '🤖', stars: 20000, tier: giftTierFromStars(20000), particleColor: '#94a3b8', description: 'Futuristic battle robot suit' },
  { id: 'emperor_throne', name: 'Emperor Throne', icon: '🪑', stars: 28000, tier: giftTierFromStars(28000), particleColor: '#fde68a', description: 'Take your seat of ultimate power' },
  { id: 'celestial_angel', name: 'Celestial Angel', icon: '👼', stars: 35000, tier: giftTierFromStars(35000), particleColor: '#fef3c7', description: 'An angelic bless from the heavens' },
  { id: 'universe_creation', name: 'Universe Creation', icon: '🌌', stars: 50000, tier: giftTierFromStars(50000), effectSvgaUrl: '/live-gifts/crown.svga', particleColor: '#38bdf8', description: 'The Big Bang inside the stream' },
  { id: 'time_portal', name: 'Time Portal', icon: '⏳', stars: 65000, tier: giftTierFromStars(65000), particleColor: '#a78bfa', description: 'Control time and space' },
  { id: 'king_of_dragons', name: 'King of Dragons', icon: '🐲', stars: 80000, tier: giftTierFromStars(80000), effectSvgaUrl: '/live-gifts/rocket.svga', particleColor: '#f59e0b', description: 'Summon the ruler of the sky' },
  { id: 'space_battleship', name: 'Space Battleship', icon: '🛸', stars: 90000, tier: giftTierFromStars(90000), particleColor: '#67e8f9', description: 'Starfleet interstellar command ship' },
  { id: 'cosmic_explosion', name: 'Cosmic Explosion', icon: '💥', stars: 99999, tier: giftTierFromStars(99999), particleColor: '#fb7185', description: 'A supernova blast of sheer power' },

  // Mythic
  { id: 'galaxy_emperor', name: 'Galaxy Emperor', icon: '👑🌌', stars: 120000, tier: giftTierFromStars(120000), effectSvgaUrl: '/live-gifts/star.svga', particleColor: '#f0abfc', description: 'Lord of the entire cosmic federation' },
  { id: 'cosmic_phoenix', name: 'Cosmic Phoenix', icon: '🔥🦅', stars: 150000, tier: giftTierFromStars(150000), effectSvgaUrl: '/live-gifts/rocket.svga', particleColor: '#fb923c', description: 'The galactic bird of eternal flame' },
  { id: 'mythic_citadel', name: 'Mythic Citadel', icon: '🏰✨', stars: 200000, tier: giftTierFromStars(200000), particleColor: '#fde68a', description: 'A sky city suspended in gold' },
  { id: 'eternal_ocean', name: 'Eternal Ocean', icon: '🌊🐋', stars: 250000, tier: giftTierFromStars(250000), effectSvgaUrl: '/live-gifts/crown.svga', particleColor: '#22d3ee', description: 'Awaken the leviathan of depth' },
  { id: 'solar_dragon', name: 'Solar Dragon', icon: '🐉☀️', stars: 350000, tier: giftTierFromStars(350000), effectSvgaUrl: '/live-gifts/rocket.svga', particleColor: '#fbbf24', description: 'Ruler of the burning stellar core' },
  { id: 'supernova_prime', name: 'Supernova Prime', icon: '💥🌟', stars: 500000, tier: giftTierFromStars(500000), effectSvgaUrl: '/live-gifts/star.svga', particleColor: '#f0abfc', description: 'The final cosmic core collapse event' },

  // Seasonal
  { id: 'xmas_tree', name: 'Xmas Tree', icon: '🎄', stars: 88, tier: giftTierFromStars(88), particleColor: '#22c55e', isSeasonal: true, season: 'Christmas', description: 'Merry Christmas joy!' },
  { id: 'santa_sleigh', name: 'Santa Sleigh', icon: '🎅', stars: 288, tier: giftTierFromStars(288), particleColor: '#ef4444', isSeasonal: true, season: 'Christmas', description: 'Santa is bearing gifts!' },
  { id: 'red_packet', name: 'Red Packet', icon: '🧧', stars: 66, tier: giftTierFromStars(66), particleColor: '#f43f5e', isSeasonal: true, season: 'Lunar New Year', description: 'Good fortune & prosperity' },
  { id: 'lion_dance', name: 'Lion Dance', icon: '🏮🦁', stars: 666, tier: giftTierFromStars(666), particleColor: '#f59e0b', isSeasonal: true, season: 'Lunar New Year', description: 'Dance to scare off bad luck!' },
  { id: 'cupids_arrow', name: "Cupid's Arrow", icon: '💘', stars: 99, tier: giftTierFromStars(99), particleColor: '#fb7185', isSeasonal: true, season: 'Valentine', description: 'Love is in the air' },
  { id: 'true_love', name: 'True Love', icon: '💏', stars: 520, tier: giftTierFromStars(520), particleColor: '#f472b6', isSeasonal: true, season: 'Valentine', description: 'I love you forever (520)' },
  { id: 'pumpkin_lantern', name: 'Pumpkin Lantern', icon: '🎃', stars: 45, tier: giftTierFromStars(45), particleColor: '#fb923c', isSeasonal: true, season: 'Halloween', description: 'Spooky halloween night' },
  { id: 'dracula_castle', name: 'Dracula Castle', icon: '🧛🏰', stars: 888, tier: giftTierFromStars(888), particleColor: '#7c3aed', isSeasonal: true, season: 'Halloween', description: 'A gothic spooky estate!' },

  // VIP
  { id: 'vip_crown', name: 'VIP Crown', icon: '👑✨', stars: 500, tier: giftTierFromStars(500), effectSvgaUrl: '/live-gifts/crown.svga', particleColor: '#fcd34d', isVipExclusive: true, description: 'The signature badge of royalty' },
  { id: 'vip_lambo', name: 'VIP Lambo', icon: '🏎️💨', stars: 1500, tier: giftTierFromStars(1500), effectSvgaUrl: '/live-gifts/rocket.svga', particleColor: '#fbbf24', isVipExclusive: true, description: 'Exclusive VIP golden supercar' },
];

const STUDIO_META_BY_ID = new Map(
  STUDIO_EXTRA_GIFTS.map((gift) => [
    gift.id,
    {
      isSeasonal: gift.isSeasonal,
      season: gift.season,
      isVipExclusive: gift.isVipExclusive,
      description: gift.description,
    } satisfies StudioGiftMeta,
  ]),
);

/** Builtin ids that also appear in the studio — keep SVGA assets, enrich meta. */
const BUILTIN_STUDIO_META: Record<string, StudioGiftMeta> = {
  rose: { description: 'Send a romantic rose' },
  heart: { description: 'Show your love' },
  mic: { description: 'Stage mic boost' },
  star: { description: 'Shine bright' },
  crown: { description: 'Crown the streamer' },
  rocket: { description: 'Blast off support' },
  diamond: { description: 'Pure luxury diamond' },
  castle: { description: 'A fortress of light' },
  phoenix: { description: 'Rising from the fire' },
  unicorn: { description: 'Legendary magical unicorn' },
  galaxy: { description: 'Celestial deep space' },
  dragon: { description: 'Roaring ancient dragon power' },
  universe: { description: 'The Big Bang inside the stream' },
  eternity: { description: 'Multi-stage cosmic event' },
  divine: { description: 'Divine blessing' },
};

export function getStudioGiftMeta(giftId: string | undefined): StudioGiftMeta {
  if (!giftId) return {};
  return STUDIO_META_BY_ID.get(giftId) ?? BUILTIN_STUDIO_META[giftId] ?? {};
}

export function listStudioExtraGiftDefinitions(): GiftEffectDefinition[] {
  return STUDIO_EXTRA_GIFTS.map(({ isSeasonal: _s, season: _se, isVipExclusive: _v, description: _d, ...gift }) => gift);
}

export const RECHARGE_PACKAGES_FALLBACK = [
  { id: 'starter', coins: 50, priceUsd: 5, bonusCoins: 0 },
  { id: 'all_coins', coins: 100, priceUsd: 10, bonusCoins: 0, isPopular: true },
  { id: 'plus', coins: 250, priceUsd: 25, bonusCoins: 0 },
  { id: 'pro', coins: 500, priceUsd: 50, bonusCoins: 0 },
  { id: 'mega', coins: 1000, priceUsd: 100, bonusCoins: 0 },
] as const;

// Re-export canonical pricing so live + wallet stay in sync (100 coins = $10).
export {
  COIN_RATE_LABEL,
  COIN_REFERENCE_COINS,
  COIN_REFERENCE_USD,
  COINS_PER_USD,
  USD_PER_COIN,
  DEFAULT_RECHARGE_PACKS,
  coinsFromUsd,
  usdFromCoins,
  usdPriceForCoins,
} from '../coinPricing';
