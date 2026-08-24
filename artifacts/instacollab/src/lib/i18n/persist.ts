import type { AppLocale } from './locales';
import { resolveAppLocale, SOURCE_LOCALE, localeEnglishName } from './locales';
import type { I18nPreference } from './types';

const LS_LOCALE_KEY = 'unilive_i18n_locale';

export function readBootLocale(): AppLocale {
  try {
    const fast = localStorage.getItem(LS_LOCALE_KEY);
    const resolvedFast = resolveAppLocale(fast);
    if (resolvedFast) return resolvedFast;
  } catch {
    /* ignore */
  }
  try {
    const raw = localStorage.getItem('app_settings');
    if (!raw) return SOURCE_LOCALE;
    const settings = JSON.parse(raw) as {
      i18n?: { locale?: string; autoTranslateUgc?: boolean };
      language?: string;
    };
    const fromI18n = resolveAppLocale(settings?.i18n?.locale);
    if (fromI18n) return fromI18n;
    const fromName = resolveAppLocale(settings?.language);
    if (fromName) return fromName;
  } catch {
    /* ignore */
  }
  return SOURCE_LOCALE;
}

export function persistLocaleFast(locale: AppLocale): void {
  try {
    localStorage.setItem(LS_LOCALE_KEY, locale);
  } catch {
    /* quota */
  }
}

export function applyDocumentLocale(locale: AppLocale, dir: 'ltr' | 'rtl', bcp47: string): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.lang = bcp47;
  root.dir = dir;
  root.setAttribute('data-locale', locale);
}

export async function persistI18nPreference(pref: I18nPreference): Promise<void> {
  persistLocaleFast(pref.locale);
  try {
    const { db } = await import('../db/localDb');
    const settings = db.settings;
    db.updateSettings({
      ...settings,
      language: localeEnglishName(pref.locale),
      i18n: {
        locale: pref.locale,
        autoTranslateUgc: Boolean(pref.autoTranslateUgc),
      },
    });
  } catch {
    /* db may not be ready during boot */
  }
}
