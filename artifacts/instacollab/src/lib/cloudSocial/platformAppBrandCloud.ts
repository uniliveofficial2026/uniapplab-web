/**
 * Platform-wide app logo — Supabase + Firebase dual lane.
 * Every user + install/PWA surfaces read the merged newest backend brand.
 */
import { isCloudAuthUserId } from '../auth/cloudProfile';
import { db } from '../db/localDb';
import {
  fetchFirebasePlatformAppBrand,
  isFirebasePlatformAppBrandAvailable,
  publishFirebasePlatformAppBrand,
  subscribeFirebasePlatformAppBrand,
} from '../firebase/platformAppBrand';
import { isSupabaseConfigured } from '../supabase/config';
import { getSupabaseClient } from '../supabase/client';

const REMOTE_CACHE_KEY = 'platform_app_brand_remote';
const PLATFORM_ROW_ID = 'default';

export type PlatformAppBrand = {
  logoUrl: string | null;
  mediaType: 'image' | 'video';
};

type BrandWithMeta = PlatformAppBrand & { updatedAt: string };

export const PLATFORM_APP_BRAND_UPDATED_EVENT = 'platform-app-brand-updated';

function normalizeSupabaseBrand(row: {
  logo_url?: string | null;
  logo_media_type?: string | null;
  updated_at?: string | null;
} | null): BrandWithMeta | null {
  if (!row) return null;
  const logoUrl =
    typeof row.logo_url === 'string' && row.logo_url.trim() ? row.logo_url.trim() : null;
  return {
    logoUrl,
    mediaType: row.logo_media_type === 'video' ? 'video' : 'image',
    updatedAt: String(row.updated_at ?? ''),
  };
}

function normalizeFirebaseBrand(
  row: Awaited<ReturnType<typeof fetchFirebasePlatformAppBrand>>,
): BrandWithMeta | null {
  if (!row) return null;
  return {
    logoUrl: row.logo_url,
    mediaType: row.logo_media_type,
    updatedAt: row.updated_at,
  };
}

function mergeBrands(...candidates: Array<BrandWithMeta | null>): PlatformAppBrand {
  const ranked = candidates
    .filter((brand): brand is BrandWithMeta => Boolean(brand))
    .sort((a, b) => {
      const aTs = Date.parse(a.updatedAt) || 0;
      const bTs = Date.parse(b.updatedAt) || 0;
      if (bTs !== aTs) return bTs - aTs;
      if (Boolean(a.logoUrl) !== Boolean(b.logoUrl)) return a.logoUrl ? -1 : 1;
      return 0;
    });

  const winner = ranked[0];
  if (!winner) return { logoUrl: null, mediaType: 'image' };
  return { logoUrl: winner.logoUrl, mediaType: winner.mediaType };
}

function readRemoteCache(): PlatformAppBrand {
  const fromDb = db.load<PlatformAppBrand | null>(REMOTE_CACHE_KEY, null);
  if (fromDb && typeof fromDb === 'object') return fromDb;

  if (typeof localStorage === 'undefined') {
    return { logoUrl: null, mediaType: 'image' };
  }
  try {
    const raw = localStorage.getItem(REMOTE_CACHE_KEY);
    if (!raw) return { logoUrl: null, mediaType: 'image' };
    const parsed = JSON.parse(raw) as PlatformAppBrand;
    if (!parsed || typeof parsed !== 'object') return { logoUrl: null, mediaType: 'image' };
    return {
      logoUrl:
        typeof parsed.logoUrl === 'string' && parsed.logoUrl.trim() ? parsed.logoUrl.trim() : null,
      mediaType: parsed.mediaType === 'video' ? 'video' : 'image',
    };
  } catch {
    return { logoUrl: null, mediaType: 'image' };
  }
}

function writeRemoteCache(brand: PlatformAppBrand): void {
  db.save(REMOTE_CACHE_KEY, brand);
  try {
    localStorage.setItem(REMOTE_CACHE_KEY, JSON.stringify(brand));
  } catch {
    /* ignore quota */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PLATFORM_APP_BRAND_UPDATED_EVENT));
    window.dispatchEvent(new CustomEvent('app-brand:updated'));
  }
}

export function readPlatformAppBrandCache(): PlatformAppBrand {
  return readRemoteCache();
}

export function isPlatformAppBrandCloudAvailable(): boolean {
  return isSupabaseConfigured() || isFirebasePlatformAppBrandAvailable();
}

async function fetchSupabasePlatformAppBrand(): Promise<BrandWithMeta | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('platform_app_brand')
    .select('logo_url, logo_media_type, updated_at')
    .eq('id', PLATFORM_ROW_ID)
    .maybeSingle();
  if (error) throw error;
  return normalizeSupabaseBrand(data);
}

export async function fetchPlatformAppBrand(): Promise<PlatformAppBrand> {
  if (!isPlatformAppBrandCloudAvailable()) return readRemoteCache();

  const [supabaseBrand, firebaseBrand] = await Promise.all([
    fetchSupabasePlatformAppBrand().catch((err) => {
      console.warn('[platform-brand/supabase] fetch failed:', err);
      return null;
    }),
    fetchFirebasePlatformAppBrand()
      .then((row) => normalizeFirebaseBrand(row))
      .catch((err) => {
        console.warn('[platform-brand/firebase] fetch failed:', err);
        return null;
      }),
  ]);

  const brand = mergeBrands(supabaseBrand, firebaseBrand);
  writeRemoteCache(brand);
  return brand;
}

async function publishSupabasePlatformAppBrand(brand: PlatformAppBrand): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.from('platform_app_brand').upsert(
    {
      id: PLATFORM_ROW_ID,
      logo_url: brand.logoUrl,
      logo_media_type: brand.mediaType,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export async function publishPlatformAppBrand(
  logoUrl: string | null,
  mediaType: 'image' | 'video' = 'image',
): Promise<void> {
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;
  if (db.currentUser?.role !== 'admin') return;

  const brand: PlatformAppBrand = {
    logoUrl: logoUrl?.trim() ? logoUrl.trim() : null,
    mediaType,
  };

  const tasks: Promise<void>[] = [];
  if (isSupabaseConfigured()) {
    tasks.push(
      publishSupabasePlatformAppBrand(brand).catch((err) => {
        console.warn('[platform-brand/supabase] publish failed:', err);
      }),
    );
  }
  if (isFirebasePlatformAppBrandAvailable()) {
    tasks.push(
      publishFirebasePlatformAppBrand({
        logoUrl: brand.logoUrl,
        mediaType: brand.mediaType,
      }).catch((err) => {
        console.warn('[platform-brand/firebase] publish failed:', err);
      }),
    );
  }

  if (tasks.length === 0) return;
  await Promise.all(tasks);
  writeRemoteCache(brand);
}

let unsubscribe: (() => void) | null = null;

export function startPlatformAppBrandRealtime(): () => void {
  stopPlatformAppBrandRealtime();
  if (!isPlatformAppBrandCloudAvailable()) return () => {};

  void fetchPlatformAppBrand();

  const stops: Array<() => void> = [];

  const supabase = getSupabaseClient();
  if (supabase) {
    const channel = supabase
      .channel('platform-app-brand')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'platform_app_brand',
          filter: `id=eq.${PLATFORM_ROW_ID}`,
        },
        () => {
          void fetchPlatformAppBrand();
        },
      )
      .subscribe();
    stops.push(() => {
      void supabase.removeChannel(channel);
    });
  }

  if (isFirebasePlatformAppBrandAvailable()) {
    stops.push(
      subscribeFirebasePlatformAppBrand(() => {
        void fetchPlatformAppBrand();
      }),
    );
  }

  unsubscribe = () => {
    stops.forEach((stop) => stop());
  };

  return stopPlatformAppBrandRealtime;
}

export function stopPlatformAppBrandRealtime(): void {
  unsubscribe?.();
  unsubscribe = null;
}

/** Boot-time fetch + realtime — works before sign-in (public read on both backends). */
export function bootstrapPlatformAppBrand(): void {
  startPlatformAppBrandRealtime();
  void Promise.all([
    import('../supabase/client').then((m) => m.initSupabaseClient()),
    import('../firebase/app').then((m) => m.getFirebaseApp()),
  ]).then(() => fetchPlatformAppBrand());
}
