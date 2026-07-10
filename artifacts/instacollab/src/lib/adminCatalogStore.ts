import { db } from './db/localDb';
import {
  dispatchPartyGiftCatalogUpdated,
  getRemotePublishedGifts,
  publishPlatformGiftCatalog,
} from './cloudSocial/platformGiftCatalogCloud';
import type {
  BeautyProvider,
  GiftEffectDefinition,
  GiftEffectTier,
  PublishedBeautyItem,
  PublishedGiftItem,
} from './live/giftEffectCatalogTypes';
import { GIFT_EFFECT_CATALOG_BASE } from './live/giftEffectCatalogBase';
import { giftTierFromStars } from './live/giftTiers';
import { PARTY_GIFT_CATALOG, type PartyGiftDefinition } from '../smule-rooms/utils/roomGifts';

const GIFT_CATALOG_KEY = 'admin_published_gifts';
const BEAUTY_CATALOG_KEY = 'admin_published_beauty';

export type { PublishedGiftItem, PublishedBeautyItem, BeautyProvider, GiftEffectTier };

function readGifts(): PublishedGiftItem[] {
  return db.load<PublishedGiftItem[]>(GIFT_CATALOG_KEY, []);
}

function publishMergedGiftCatalog(localItems: PublishedGiftItem[], removedIds: string[] = []): void {
  const removed = new Set(removedIds);
  const remote = getRemotePublishedGifts().filter((gift) => !removed.has(gift.id));
  const localIds = new Set(localItems.map((gift) => gift.id));
  const merged = [
    ...localItems.filter((gift) => !removed.has(gift.id)),
    ...remote.filter((gift) => !localIds.has(gift.id)),
  ];
  void publishPlatformGiftCatalog(merged);
}

function writeGifts(items: PublishedGiftItem[], removedIds: string[] = []): void {
  db.save(GIFT_CATALOG_KEY, items);
  db.addAuditLog?.({
    id: Date.now(),
    text: `Gift catalog updated (${items.filter((g) => g.status === 'published').length} published)`,
    time: 'Just now',
  });
  dispatchPartyGiftCatalogUpdated();
  publishMergedGiftCatalog(items, removedIds);
}

function readBeauty(): PublishedBeautyItem[] {
  return db.load<PublishedBeautyItem[]>(BEAUTY_CATALOG_KEY, []);
}

function writeBeauty(items: PublishedBeautyItem[]): void {
  db.save(BEAUTY_CATALOG_KEY, items);
  db.addAuditLog?.({
    id: Date.now(),
    text: `Beauty catalog updated (${items.filter((b) => b.status === 'published').length} published)`,
    time: 'Just now',
  });
}

function mergePublishedGiftSources(): PublishedGiftItem[] {
  const local = listPublishedGifts(false);
  const remote = getRemotePublishedGifts();
  const byId = new Map<string, PublishedGiftItem>();
  for (const gift of remote) {
    byId.set(gift.id, gift);
  }
  for (const gift of local) {
    byId.set(gift.id, gift);
  }
  return Array.from(byId.values());
}

function toPartyGiftRow(gift: PublishedGiftItem): PartyGiftDefinition {
  const stars = Math.max(1, Number(gift.stars) || 1);
  return {
    id: gift.id,
    name: gift.name,
    icon: gift.icon,
    stars,
    tier: giftTierFromStars(stars),
    effectVideoUrl: gift.effectVideoUrl,
    effectSvgaUrl: gift.effectSvgaUrl,
    particleColor: gift.particleColor,
  };
}

export function listPublishedGifts(includeDrafts = true): PublishedGiftItem[] {
  const local = readGifts();
  const remote = getRemotePublishedGifts();
  const byId = new Map<string, PublishedGiftItem>();
  for (const gift of remote) {
    byId.set(gift.id, gift);
  }
  for (const gift of local) {
    if (!includeDrafts && gift.status !== 'published') continue;
    byId.set(gift.id, gift);
  }
  return Array.from(byId.values()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export function listPublishedBeauty(includeDrafts = true): PublishedBeautyItem[] {
  const items = readBeauty();
  return includeDrafts ? items : items.filter((b) => b.status === 'published');
}

export function upsertPublishedGift(input: Omit<PublishedGiftItem, 'updatedAt'>): PublishedGiftItem {
  const items = readGifts();
  const stars = Math.max(1, Number(input.stars) || 1);
  const row: PublishedGiftItem = {
    ...input,
    stars,
    tier: giftTierFromStars(stars),
    updatedAt: Date.now(),
  };
  const idx = items.findIndex((g) => g.id === row.id);
  if (idx >= 0) items[idx] = row;
  else items.unshift(row);
  writeGifts(items);
  return row;
}

export function upsertPublishedBeauty(input: Omit<PublishedBeautyItem, 'updatedAt'>): PublishedBeautyItem {
  const items = readBeauty();
  const row: PublishedBeautyItem = { ...input, updatedAt: Date.now() };
  const idx = items.findIndex((b) => b.id === row.id);
  if (idx >= 0) items[idx] = row;
  else items.unshift(row);
  writeBeauty(items);
  return row;
}

export function deletePublishedGift(id: string): void {
  writeGifts(
    readGifts().filter((g) => g.id !== id),
    [id],
  );
}

/** Builtin in-app gifts + admin drafts/overrides for Creation Studio edit/replace. */
export function listStudioGiftCatalog(): PublishedGiftItem[] {
  const published = mergePublishedGiftSources();
  const drafts = readGifts().filter((gift) => gift.status === 'draft');
  const byId = new Map<string, PublishedGiftItem>();

  for (const gift of GIFT_EFFECT_CATALOG_BASE) {
    byId.set(gift.id, {
      ...gift,
      tier: giftTierFromStars(gift.stars),
      status: 'published',
      updatedAt: 0,
    });
  }
  for (const gift of published) {
    byId.set(gift.id, gift);
  }
  for (const gift of drafts) {
    byId.set(gift.id, gift);
  }

  return Array.from(byId.values()).sort((a, b) => {
    const aBuiltin = GIFT_EFFECT_CATALOG_BASE.some((g) => g.id === a.id) ? 0 : 1;
    const bBuiltin = GIFT_EFFECT_CATALOG_BASE.some((g) => g.id === b.id) ? 0 : 1;
    if (aBuiltin !== bBuiltin) return aBuiltin - bBuiltin;
    if (a.stars !== b.stars) return a.stars - b.stars;
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });
}

export function isBuiltinGiftId(id: string): boolean {
  return GIFT_EFFECT_CATALOG_BASE.some((gift) => gift.id === id);
}

/** Reset a builtin gift override so the in-app default returns. */
export function resetBuiltinGiftOverride(id: string): void {
  if (!isBuiltinGiftId(id)) {
    deletePublishedGift(id);
    return;
  }
  writeGifts(
    readGifts().filter((g) => g.id !== id),
    [id],
  );
}

export function deletePublishedBeauty(id: string): void {
  writeBeauty(readBeauty().filter((b) => b.id !== id));
}

export function getMergedGiftEffectCatalog(): GiftEffectDefinition[] {
  const published = mergePublishedGiftSources();
  if (published.length === 0) return GIFT_EFFECT_CATALOG_BASE;
  const base = [...GIFT_EFFECT_CATALOG_BASE];
  for (const gift of published) {
    const idx = base.findIndex((g) => g.id === gift.id || g.name.toLowerCase() === gift.name.toLowerCase());
    const stars = Math.max(1, Number(gift.stars) || 1);
    const row: GiftEffectDefinition = {
      id: gift.id,
      name: gift.name,
      icon: gift.icon,
      stars,
      tier: giftTierFromStars(stars),
      effectSvgaUrl: gift.effectSvgaUrl,
      effectVideoUrl: gift.effectVideoUrl,
      particleColor: gift.particleColor,
    };
    if (idx >= 0) base[idx] = row;
    else base.push(row);
  }
  return base;
}

export function getMergedPartyGiftCatalog(): PartyGiftDefinition[] {
  const published = mergePublishedGiftSources();
  if (published.length === 0) return PARTY_GIFT_CATALOG;
  const base = [...PARTY_GIFT_CATALOG];
  for (const gift of published) {
    const idx = base.findIndex(
      (g) => (gift.id && g.id === gift.id) || g.name.toLowerCase() === gift.name.toLowerCase(),
    );
    const row = toPartyGiftRow(gift);
    if (idx >= 0) base[idx] = row;
    else base.push(row);
  }
  return base;
}

export function createEmptyGiftDraft(): PublishedGiftItem {
  const stars = 10;
  return {
    id: `gift-${Date.now()}`,
    name: 'New Gift',
    icon: '🎁',
    stars,
    tier: giftTierFromStars(stars),
    status: 'draft',
    updatedAt: Date.now(),
  };
}

export function createEmptyBeautyDraft(): PublishedBeautyItem {
  return {
    id: `beauty-${Date.now()}`,
    name: 'New Beauty',
    provider: 'trtc',
    category: 'beauty',
    status: 'draft',
    updatedAt: Date.now(),
  };
}

export function listPublishedBeautyPresets(): PublishedBeautyItem[] {
  return listPublishedBeauty(false);
}
