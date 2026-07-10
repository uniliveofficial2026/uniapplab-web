import { getMergedGiftEffectCatalog } from '../adminCatalogStore';
import { GIFT_EFFECT_CATALOG_BASE } from './giftEffectCatalogBase';
import {
  giftEffectDurationMs,
  giftTierFromStars,
  normalizeGiftTier,
  type GiftEffectTier,
} from './giftTiers';
import type { GiftEffectDefinition } from './giftEffectCatalogTypes';

export type { GiftEffectDefinition, GiftEffectTier } from './giftEffectCatalogTypes';
export {
  giftEffectDurationMs,
  giftTierFromStars,
  normalizeGiftTier,
  GIFT_TIER_META,
  GIFT_TIER_OPTIONS,
  giftTierMeta,
} from './giftTiers';

export const GIFT_EFFECT_CATALOG = GIFT_EFFECT_CATALOG_BASE;

export function resolveGiftEffect(giftId?: string, giftName?: string): GiftEffectDefinition {
  const catalog = getMergedGiftEffectCatalog();
  const byId = new Map(catalog.map((gift) => [gift.id.toLowerCase(), gift]));
  const byName = new Map(catalog.map((gift) => [gift.name.toLowerCase(), gift]));
  const id = giftId?.trim().toLowerCase();
  if (id && byId.has(id)) return withCoinTier(byId.get(id)!);
  const name = giftName?.trim().toLowerCase();
  if (name && byName.has(name)) return withCoinTier(byName.get(name)!);
  return withCoinTier(catalog[0] ?? GIFT_EFFECT_CATALOG_BASE[0]);
}

/** Coin value always wins for showcase / play animation tier. */
export function withCoinTier(gift: GiftEffectDefinition): GiftEffectDefinition {
  return {
    ...gift,
    tier: giftTierFromStars(gift.stars),
  };
}

export function resolvePlayTier(gift: {
  giftId?: string;
  giftName?: string;
  starValue?: number;
}): GiftEffectTier {
  if (typeof gift.starValue === 'number' && gift.starValue > 0) {
    return giftTierFromStars(gift.starValue);
  }
  const definition = resolveGiftEffect(gift.giftId, gift.giftName);
  return normalizeGiftTier(definition.tier, definition.stars);
}
