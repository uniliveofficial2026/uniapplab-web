/**
 * Cross-user platform gift catalog — Supabase + Firebase dual lane.
 * Published gifts visible in every live room + gift studio.
 */
import { isCloudAuthUserId } from '../auth/cloudProfile';
import { db } from '../db/localDb';
import {
  fetchFirebasePlatformGiftCatalog,
  isFirebasePlatformGiftCatalogAvailable,
  publishFirebasePlatformGiftCatalog,
  subscribeFirebasePlatformGiftCatalog,
} from '../firebase/platformGiftCatalog';
import type { PublishedGiftItem } from '../live/giftEffectCatalogTypes';
import { isSocialCloudAvailable } from '../social/socialCloud';
import { isSupabaseConfigured } from '../supabase/config';
import { getSupabaseClient } from '../supabase/client';

const REMOTE_CACHE_KEY = 'platform_gift_catalog_remote';
const PLATFORM_ROW_ID = 'default';

export const PARTY_GIFT_CATALOG_UPDATED_EVENT = 'party-gift-catalog-updated';

export function dispatchPartyGiftCatalogUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PARTY_GIFT_CATALOG_UPDATED_EVENT));
}

export function isPlatformGiftCatalogCloudAvailable(): boolean {
  return isSocialCloudAvailable() || isFirebasePlatformGiftCatalogAvailable();
}

function readRemoteCache(): PublishedGiftItem[] {
  return db.load<PublishedGiftItem[]>(REMOTE_CACHE_KEY, []);
}

function writeRemoteCache(items: PublishedGiftItem[]): void {
  db.save(REMOTE_CACHE_KEY, items);
  dispatchPartyGiftCatalogUpdated();
}

function mergeGiftLists(...lists: PublishedGiftItem[][]): PublishedGiftItem[] {
  const byId = new Map<string, PublishedGiftItem>();
  for (const list of lists) {
    for (const gift of list) {
      if (!gift?.id) continue;
      const prev = byId.get(gift.id);
      if (!prev || (gift.updatedAt ?? 0) >= (prev.updatedAt ?? 0)) {
        byId.set(gift.id, gift);
      }
    }
  }
  return Array.from(byId.values()).filter((gift) => gift.status === 'published');
}

async function fetchSupabasePlatformGiftCatalog(): Promise<PublishedGiftItem[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('platform_gift_catalog')
    .select('gifts, updated_at')
    .eq('id', PLATFORM_ROW_ID)
    .maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.gifts) ? (data.gifts as PublishedGiftItem[]) : [];
}

export async function fetchPlatformGiftCatalog(): Promise<PublishedGiftItem[]> {
  if (!isPlatformGiftCatalogCloudAvailable()) return readRemoteCache();

  const [supabaseGifts, firebaseGifts] = await Promise.all([
    fetchSupabasePlatformGiftCatalog().catch((err) => {
      console.warn('[platform-gifts/supabase] fetch failed:', err);
      return [] as PublishedGiftItem[];
    }),
    fetchFirebasePlatformGiftCatalog().catch((err) => {
      console.warn('[platform-gifts/firebase] fetch failed:', err);
      return [] as PublishedGiftItem[];
    }),
  ]);

  const gifts = mergeGiftLists(supabaseGifts, firebaseGifts);
  writeRemoteCache(gifts);
  return gifts;
}

async function publishSupabasePlatformGiftCatalog(published: PublishedGiftItem[]): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.from('platform_gift_catalog').upsert(
    {
      id: PLATFORM_ROW_ID,
      gifts: published,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export async function publishPlatformGiftCatalog(items: PublishedGiftItem[]): Promise<void> {
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;
  if (db.currentUser?.role !== 'admin') return;

  const published = items.filter((gift) => gift.status === 'published');
  const tasks: Promise<void>[] = [];

  if (isSupabaseConfigured()) {
    tasks.push(
      publishSupabasePlatformGiftCatalog(published).catch((err) => {
        console.warn('[platform-gifts/supabase] publish failed:', err);
      }),
    );
  }
  if (isFirebasePlatformGiftCatalogAvailable()) {
    tasks.push(
      publishFirebasePlatformGiftCatalog(published).catch((err) => {
        console.warn('[platform-gifts/firebase] publish failed:', err);
      }),
    );
  }

  if (tasks.length === 0) {
    writeRemoteCache(published);
    return;
  }
  await Promise.all(tasks);
  writeRemoteCache(published);
}

let unsubscribe: (() => void) | null = null;

export function startPlatformGiftCatalogRealtime(): () => void {
  stopPlatformGiftCatalogRealtime();
  if (!isPlatformGiftCatalogCloudAvailable()) return () => {};

  void fetchPlatformGiftCatalog();

  const stops: Array<() => void> = [];
  const supabase = getSupabaseClient();
  if (supabase) {
    const channel = supabase
      .channel('platform-gift-catalog')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'platform_gift_catalog',
          filter: `id=eq.${PLATFORM_ROW_ID}`,
        },
        () => {
          void fetchPlatformGiftCatalog();
        },
      )
      .subscribe();
    stops.push(() => {
      void supabase.removeChannel(channel);
    });
  }

  if (isFirebasePlatformGiftCatalogAvailable()) {
    stops.push(
      subscribeFirebasePlatformGiftCatalog(() => {
        void fetchPlatformGiftCatalog();
      }),
    );
  }

  unsubscribe = () => {
    stops.forEach((stop) => stop());
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
