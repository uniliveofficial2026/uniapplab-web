/**
 * Cross-user platform gift catalog — published gifts visible in every live room.
 */
import { isCloudAuthUserId } from '../auth/cloudProfile';
import { db } from '../db/localDb';
import type { PublishedGiftItem } from '../live/giftEffectCatalogTypes';
import { isSocialCloudAvailable } from '../social/socialCloud';
import { getSupabaseClient } from '../supabase/client';

const REMOTE_CACHE_KEY = 'platform_gift_catalog_remote';
const PLATFORM_ROW_ID = 'default';

export const PARTY_GIFT_CATALOG_UPDATED_EVENT = 'party-gift-catalog-updated';

export function dispatchPartyGiftCatalogUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PARTY_GIFT_CATALOG_UPDATED_EVENT));
}

export function isPlatformGiftCatalogCloudAvailable(): boolean {
  return isSocialCloudAvailable();
}

function readRemoteCache(): PublishedGiftItem[] {
  return db.load<PublishedGiftItem[]>(REMOTE_CACHE_KEY, []);
}

function writeRemoteCache(items: PublishedGiftItem[]): void {
  db.save(REMOTE_CACHE_KEY, items);
  dispatchPartyGiftCatalogUpdated();
}

export async function fetchPlatformGiftCatalog(): Promise<PublishedGiftItem[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return readRemoteCache();

  try {
    const { data, error } = await supabase
      .from('platform_gift_catalog')
      .select('gifts, updated_at')
      .eq('id', PLATFORM_ROW_ID)
      .maybeSingle();
    if (error) throw error;
    const gifts = Array.isArray(data?.gifts) ? (data.gifts as PublishedGiftItem[]) : [];
    writeRemoteCache(gifts);
    return gifts;
  } catch (err) {
    console.warn('[platform-gifts] fetch failed:', err);
    return readRemoteCache();
  }
}

export async function publishPlatformGiftCatalog(items: PublishedGiftItem[]): Promise<void> {
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;
  if (db.currentUser?.role !== 'admin') return;

  const published = items.filter((gift) => gift.status === 'published');
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const { error } = await supabase.from('platform_gift_catalog').upsert(
      {
        id: PLATFORM_ROW_ID,
        gifts: published,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (error) throw error;
    writeRemoteCache(published);
  } catch (err) {
    console.warn('[platform-gifts] publish failed:', err);
  }
}

let unsubscribe: (() => void) | null = null;

export function startPlatformGiftCatalogRealtime(): () => void {
  stopPlatformGiftCatalogRealtime();
  if (!isPlatformGiftCatalogCloudAvailable()) return () => {};

  void fetchPlatformGiftCatalog();

  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel('platform-gift-catalog')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'platform_gift_catalog', filter: `id=eq.${PLATFORM_ROW_ID}` },
      () => {
        void fetchPlatformGiftCatalog();
      },
    )
    .subscribe();

  unsubscribe = () => {
    void supabase.removeChannel(channel);
  };

  return stopPlatformGiftCatalogRealtime;
}

export function stopPlatformGiftCatalogRealtime(): void {
  unsubscribe?.();
  unsubscribe = null;
}

export function getRemotePublishedGifts(): PublishedGiftItem[] {
  return readRemoteCache().filter((gift) => gift.status === 'published');
}
