import type { AppLocale } from './locales';
import { SOURCE_LOCALE } from './locales';
import { SEMANTIC_EN } from './semanticCatalog';
import { semanticKeysFor } from './semanticTranslations';
import { glossaryTranslate } from './glossary';
import { pseudoExpand, pseudoRtl } from './pseudo';
import type { I18nCatalog } from './types';
import { LOCALE_META } from './locales';

export const CATALOG_VERSION = '2026.08.12.i18n.v1';

const memory = new Map<string, I18nCatalog>();
const PERSIST_CACHE_PREFIX = 'unilive-i18n-';

function cacheKey(locale: AppLocale): string {
  return `${locale}::${CATALOG_VERSION}`;
}

function persistCacheName(): string {
  return `${PERSIST_CACHE_PREFIX}${CATALOG_VERSION}`;
}

async function readPersistentCatalog(locale: AppLocale): Promise<I18nCatalog | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(persistCacheName());
    const res = await cache.match(`/__i18n_catalog__/${locale}`);
    if (!res?.ok) return null;
    const data = (await res.json()) as I18nCatalog;
    if (data?.v && data.locale === locale && String(data.version || '') === CATALOG_VERSION) {
      return data;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function writePersistentCatalog(catalog: I18nCatalog): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(persistCacheName());
    await cache.put(
      `/__i18n_catalog__/${catalog.locale}`,
      new Response(JSON.stringify(catalog), {
        headers: { 'content-type': 'application/json', 'cache-control': 'max-age=31536000, immutable' },
      }),
    );
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(PERSIST_CACHE_PREFIX) && key !== persistCacheName())
        .map((key) => caches.delete(key)),
    );
  } catch {
    /* ignore */
  }
}

function buildLiteralMap(locale: AppLocale, overlay: Record<string, string>, englishLiterals: Record<string, string>): Record<string, string> {
  const literals: Record<string, string> = {};
  for (const [en, value] of Object.entries(englishLiterals)) {
    if (locale === SOURCE_LOCALE) literals[en] = value;
    else literals[en] = overlay[en] || glossaryTranslate(en, locale);
  }
  for (const [key, en] of Object.entries(SEMANTIC_EN)) {
    const localized = semanticKeysFor(locale)[key] || glossaryTranslate(en, locale);
    if (en && !literals[en]) literals[en] = localized;
  }
  return literals;
}

export function buildEnglishCatalog(literals: Record<string, string> = {}): I18nCatalog {
  const lit: Record<string, string> = { ...literals };
  for (const value of Object.values(SEMANTIC_EN)) {
    if (value && !lit[value]) lit[value] = value;
  }
  return {
    v: 1,
    locale: SOURCE_LOCALE,
    version: CATALOG_VERSION,
    keys: { ...SEMANTIC_EN },
    literals: lit,
  };
}

export function buildLocaleCatalog(
  locale: AppLocale,
  english: I18nCatalog,
  overlay?: Partial<I18nCatalog>,
): I18nCatalog {
  if (locale === SOURCE_LOCALE) return english;
  const meta = LOCALE_META[locale];
  if (meta.pseudo) {
    const transform = meta.pseudo === 'rtl' ? pseudoRtl : pseudoExpand;
    const keys: Record<string, string> = {};
    const literals: Record<string, string> = {};
    for (const [k, v] of Object.entries(english.keys)) keys[k] = transform(v);
    for (const [k, v] of Object.entries(english.literals)) literals[k] = transform(v);
    return { v: 1, locale, version: CATALOG_VERSION, keys, literals };
  }
  const keys = {
    ...semanticKeysFor(locale),
    ...(overlay?.keys || {}),
  };
  const literals = buildLiteralMap(locale, overlay?.literals || {}, english.literals);
  return {
    v: 1,
    locale,
    version: String(overlay?.version || CATALOG_VERSION),
    machineTranslated: overlay?.machineTranslated !== false,
    keys,
    literals,
  };
}

let englishPromise: Promise<I18nCatalog> | null = null;

export async function loadLiteralOverlay(): Promise<Record<string, string>> {
  if (typeof fetch === 'undefined') return {};
  try {
    const res = await fetch(`/i18n/literals-en.json?v=${CATALOG_VERSION}`, { cache: 'force-cache' });
    if (!res.ok) return {};
    const data = (await res.json()) as { literals?: Record<string, string> };
    return data.literals && typeof data.literals === 'object' ? data.literals : {};
  } catch {
    return {};
  }
}

export async function loadEnglishCatalog(): Promise<I18nCatalog> {
  if (!englishPromise) {
    englishPromise = (async () => {
      const literals = await loadLiteralOverlay();
      const catalog = buildEnglishCatalog(literals);
      memory.set(cacheKey(SOURCE_LOCALE), catalog);
      return catalog;
    })();
  }
  return englishPromise;
}

export async function loadLocaleCatalog(locale: AppLocale): Promise<I18nCatalog> {
  const hit = memory.get(cacheKey(locale));
  if (hit) return hit;

  const persisted = await readPersistentCatalog(locale);
  if (persisted) {
    memory.set(cacheKey(locale), persisted);
    return persisted;
  }

  const english = await loadEnglishCatalog();
  if (locale === SOURCE_LOCALE) {
    void writePersistentCatalog(english);
    return english;
  }

  let overlay: Partial<I18nCatalog> | undefined;
  try {
    const res = await fetch(`/i18n/${encodeURIComponent(locale)}.json?v=${CATALOG_VERSION}`, {
      cache: 'force-cache',
    });
    if (res.ok) overlay = (await res.json()) as Partial<I18nCatalog>;
  } catch {
    overlay = undefined;
  }
  const catalog = buildLocaleCatalog(locale, english, overlay);
  memory.set(cacheKey(locale), catalog);
  void writePersistentCatalog(catalog);
  return catalog;
}

export function getCachedCatalog(locale: AppLocale): I18nCatalog | null {
  return memory.get(cacheKey(locale)) ?? null;
}

export function rememberCatalog(catalog: I18nCatalog): void {
  memory.set(cacheKey(catalog.locale), catalog);
}

export async function prefetchLocaleCatalogs(locales: AppLocale[]): Promise<void> {
  await Promise.allSettled(locales.map((locale) => loadLocaleCatalog(locale)));
}
