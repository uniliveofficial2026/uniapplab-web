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
import { PARTY_GIFT_CATALOG, type PartyGiftDefinition } from '../smule-rooms/utils/roomGifts';

const GIFT_CATALOG_KEY = 'admin_published_gifts';
const BEAUTY_CATALOG_KEY = 'admin_published_beauty';

export type { PublishedGiftItem, PublishedBeautyItem, BeautyProvider, GiftEffectTier };

function readGifts(): PublishedGiftItem[] {
  return db.load<PublishedGiftItem[]>(GIFT_CATALOG_KEY, []);
}

function writeGifts(items: PublishedGiftItem[]): void {
  db.save(GIFT_CATALOG_KEY, items);
  db.addAuditLog?.({
    id: Date.now(),
    text: `Gift catalog updated (${items.filter((g) => g.status === 'published').length} published)`,
    time: 'Just now',
  });
  dispatchPartyGiftCatalogUpdated();
  void publishPlatformGiftCatalog(items);
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
  return {
    id: gift.id,
    name: gift.name,
    icon: gift.icon,
    stars: gift.stars,
    tier: gift.tier,
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
  const row: PublishedGiftItem = { ...input, updatedAt: Date.now() };
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
  writeGifts(readGifts().filter((g) => g.id !== id));
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
    const row: GiftEffectDefinition = {
      id: gift.id,
      name: gift.name,
      icon: gift.icon,
      stars: gift.stars,
      tier: gift.tier,
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
  return {
    id: `gift-${Date.now()}`,
    name: 'New Gift',
    icon: '🎁',
    stars: 10,
    tier: 'standard',
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
