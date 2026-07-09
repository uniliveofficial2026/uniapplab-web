import { getMergedGiftEffectCatalog } from '../adminCatalogStore';
import { GIFT_EFFECT_CATALOG_BASE } from './giftEffectCatalogBase';
import type { GiftEffectDefinition, GiftEffectTier } from './giftEffectCatalogTypes';

export type { GiftEffectDefinition, GiftEffectTier } from './giftEffectCatalogTypes';

export const GIFT_EFFECT_CATALOG = GIFT_EFFECT_CATALOG_BASE;

export function resolveGiftEffect(giftId?: string, giftName?: string): GiftEffectDefinition {
  const catalog = getMergedGiftEffectCatalog();
  const byId = new Map(catalog.map((gift) => [gift.id, gift]));
  const byName = new Map(catalog.map((gift) => [gift.name.toLowerCase(), gift]));
  const id = giftId?.trim().toLowerCase();
  if (id && byId.has(id)) return byId.get(id)!;
  const name = giftName?.trim().toLowerCase();
  if (name && byName.has(name)) return byName.get(name)!;
  return catalog[0] ?? GIFT_EFFECT_CATALOG_BASE[0];
}

export function giftEffectDurationMs(tier: GiftEffectTier): number {
  if (tier === 'combo') return 2400;
  if (tier === 'standard') return 3200;
  return 4200;
}
