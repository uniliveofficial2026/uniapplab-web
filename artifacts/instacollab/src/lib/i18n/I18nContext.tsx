import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  APP_LOCALES,
  LOCALE_META,
  SOURCE_LOCALE,
  isAppLocale,
  localeEnglishName,
  resolveAppLocale,
  type AppLocale,
} from './locales';
import { interpolate } from './interpolate';
import { SEMANTIC_EN } from './semanticCatalog';
import {
  buildEnglishCatalog,
  buildLocaleCatalog,
  getCachedCatalog,
  loadEnglishCatalog,
  loadLocaleCatalog,
  prefetchLocaleCatalogs,
  rememberCatalog,
} from './catalogCache';
import { evaluateCompleteness } from './completeness';
import { applyDocumentLocale, persistI18nPreference, readBootLocale } from './persist';
import { activateFormatterLocale, invalidateFormatters } from './formatters';
import { ensureLocaleFonts, prefetchLocaleFonts } from './fonts';
import {
  countPreviousLanguageWords,
  countRawTranslationKeys,
  reconcileMountedText,
} from './reconciler';
import type { CompletenessReport, I18nCatalog, TranslationParams, TranslatableMessage } from './types';
import { translateVisibleUgc } from './ugcClient';

export type SwitchLocaleResult =
  | { ok: true; locale: AppLocale }
  | { ok: false; errorKey: string; preservedTarget: AppLocale };

type I18nContextValue = {
  locale: AppLocale;
  dir: 'ltr' | 'rtl';
  bcp47: string;
  catalog: I18nCatalog;
  generation: number;
  preparing: boolean;
  lastErrorKey: string | null;
  pendingTarget: AppLocale | null;
  selectableLocales: AppLocale[];
  completeness: Partial<Record<AppLocale, CompletenessReport>>;
  t: (key: string, params?: TranslationParams) => string;
  translateLiteral: (english: string) => string;
  translateMessage: (msg: TranslatableMessage | string) => string;
  switchLocale: (target: AppLocale | string) => Promise<SwitchLocaleResult>;
  prefetchForSelector: () => void;
  providerLocale: string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function bootCatalog(locale: AppLocale): I18nCatalog {
  const cached = getCachedCatalog(locale);
  if (cached) return cached;
  const english = getCachedCatalog(SOURCE_LOCALE) ?? buildEnglishCatalog();
  rememberCatalog(english);
  if (locale === SOURCE_LOCALE) return english;
  const next = buildLocaleCatalog(locale, english);
  rememberCatalog(next);
  applyDocumentLocale(locale, LOCALE_META[locale].dir, LOCALE_META[locale].bcp47);
  activateFormatterLocale(locale);
  return next;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const boot = readBootLocale();
  const [locale, setLocale] = useState<AppLocale>(boot);
  const [catalog, setCatalog] = useState<I18nCatalog>(() => bootCatalog(boot));
  const [generation, setGeneration] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [lastErrorKey, setLastErrorKey] = useState<string | null>(null);
  const [pendingTarget, setPendingTarget] = useState<AppLocale | null>(null);
  const [completeness, setCompleteness] = useState<Partial<Record<AppLocale, CompletenessReport>>>({});
  const previousCatalogRef = useRef<I18nCatalog | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const prefetchStarted = useRef(false);

  const meta = LOCALE_META[locale];

  const commitVisual = useCallback((nextLocale: AppLocale, nextCatalog: I18nCatalog) => {
    const previous = previousCatalogRef.current ?? catalog;
    previousCatalogRef.current = nextCatalog;
    applyDocumentLocale(nextLocale, LOCALE_META[nextLocale].dir, LOCALE_META[nextLocale].bcp47);
    invalidateFormatters();
    activateFormatterLocale(nextLocale);
    setLocale(nextLocale);
    setCatalog(nextCatalog);
    setGeneration((g) => g + 1);
    rememberCatalog(nextCatalog);
    void persistI18nPreference({ locale: nextLocale });
    requestAnimationFrame(() => {
      if (typeof document === 'undefined') return;
      reconcileMountedText(document.body, nextCatalog, previous);
    });
  }, [catalog]);

  useEffect(() => {
    applyDocumentLocale(locale, meta.dir, meta.bcp47);
    activateFormatterLocale(locale);
    let cancelled = false;
    void (async () => {
      try {
        await ensureLocaleFonts(locale);
        const loaded = await loadLocaleCatalog(locale);
        if (cancelled) return;
        rememberCatalog(loaded);
        setCatalog(loaded);
        previousCatalogRef.current = loaded;
        setGeneration((g) => g + 1);
        requestAnimationFrame(() => {
          if (typeof document === 'undefined') return;
          reconcileMountedText(document.body, loaded, null);
        });
      } catch {
        /* keep boot catalog */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    observerRef.current?.disconnect();
    let raf = 0;
    const obs = new MutationObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        reconcileMountedText(document.body, catalog, previousCatalogRef.current);
      });
    });
    obs.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label', 'alt'],
    });
    observerRef.current = obs;
    return () => {
      if (raf) cancelAnimationFrame(raf);
      obs.disconnect();
    };
  }, [catalog, generation]);

  const prefetchForSelector = useCallback(() => {
    if (prefetchStarted.current) return;
    prefetchStarted.current = true;
    prefetchLocaleFonts([...APP_LOCALES]);
    void (async () => {
      await prefetchLocaleCatalogs([...APP_LOCALES]);
      const english = await loadEnglishCatalog();
      const reports: Partial<Record<AppLocale, CompletenessReport>> = {};
      for (const loc of APP_LOCALES) {
        try {
          const cat = await loadLocaleCatalog(loc);
          reports[loc] = evaluateCompleteness(english, cat);
        } catch {
          reports[loc] = {
            locale: loc,
            requiredKeys: Object.keys(SEMANTIC_EN).length,
            missingKeys: ['*'],
            copiedEnglishKeys: [],
            placeholderFailures: [],
            pluralFailures: [],
            dirOk: true,
            fontOk: true,
            nativeOk: false,
            assetsOk: true,
            runtimeOk: false,
            pass: false,
          };
        }
      }
      setCompleteness(reports);
    })();
  }, []);

  const selectableLocales = useMemo(() => {
    return APP_LOCALES.filter((loc) => {
      if (loc === SOURCE_LOCALE) return true;
      const report = completeness[loc];
      if (!report) return getCachedCatalog(loc) != null;
      return report.pass;
    });
  }, [completeness]);

  const t = useCallback(
    (key: string, params?: TranslationParams) => {
      const template = catalog.keys[key] ?? SEMANTIC_EN[key] ?? key;
      return interpolate(template, params);
    },
    [catalog, generation],
  );

  const translateLiteral = useCallback(
    (english: string) => {
      if (!english) return english;
      return catalog.literals[english] ?? catalog.literals[english.trim()] ?? english;
    },
    [catalog, generation],
  );

  const translateMessage = useCallback(
    (msg: TranslatableMessage | string) => {
      if (typeof msg === 'string') return translateLiteral(msg);
      if (msg.translationKey === '__literal__' && msg.params?.text != null) {
        return translateLiteral(String(msg.params.text));
      }
      return t(msg.translationKey, msg.params);
    },
    [t, translateLiteral],
  );

  const switchLocale = useCallback(
    async (rawTarget: AppLocale | string): Promise<SwitchLocaleResult> => {
      const target = isAppLocale(rawTarget) ? rawTarget : resolveAppLocale(rawTarget);
      if (!target) {
        return { ok: false, errorKey: 'settings.languageUnavailable', preservedTarget: locale };
      }
      if (target === locale && catalog.version !== 'boot') {
        return { ok: true, locale: target };
      }
      setPendingTarget(target);
      setPreparing(true);
      setLastErrorKey(null);
      try {
        await ensureLocaleFonts(target);
        const english = await loadEnglishCatalog();
        const nextCatalog = await loadLocaleCatalog(target);
        const report = evaluateCompleteness(english, nextCatalog);
        setCompleteness((prev) => ({ ...prev, [target]: report }));
        if (!report.pass) {
          setLastErrorKey('settings.languageUnavailable');
          setPreparing(false);
          return { ok: false, errorKey: 'settings.languageUnavailable', preservedTarget: target };
        }
        try {
          await translateVisibleUgc(target);
        } catch {
          /* UGC best-effort; system strings still commit atomically */
        }
        commitVisual(target, nextCatalog);
        setPreparing(false);
        setPendingTarget(null);
        return { ok: true, locale: target };
      } catch {
        setLastErrorKey('settings.languageSwitchFailed');
        setPreparing(false);
        return { ok: false, errorKey: 'settings.languageSwitchFailed', preservedTarget: target };
      }
    },
    [catalog.version, commitVisual, locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dir: meta.dir,
      bcp47: meta.bcp47,
      catalog,
      generation,
      preparing,
      lastErrorKey,
      pendingTarget,
      selectableLocales,
      completeness,
      t,
      translateLiteral,
      translateMessage,
      switchLocale,
      prefetchForSelector,
      providerLocale: meta.providerLocale,
    }),
    [
      locale,
      meta.dir,
      meta.bcp47,
      meta.providerLocale,
      catalog,
      generation,
      preparing,
      lastErrorKey,
      pendingTarget,
      selectableLocales,
      completeness,
      t,
      translateLiteral,
      translateMessage,
      switchLocale,
      prefetchForSelector,
    ],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}

export function useOptionalI18n(): I18nContextValue | null {
  return useContext(I18nContext);
}

export function scanAtomicSwitch(previous: I18nCatalog, next: I18nCatalog): {
  previousLanguageVisible: number;
  rawKeysVisible: number;
} {
  if (typeof document === 'undefined') {
    return { previousLanguageVisible: 0, rawKeysVisible: 0 };
  }
  reconcileMountedText(document.body, next, previous);
  return {
    previousLanguageVisible: countPreviousLanguageWords(document.body, previous, next),
    rawKeysVisible: countRawTranslationKeys(document.body),
  };
}

export { localeEnglishName };
