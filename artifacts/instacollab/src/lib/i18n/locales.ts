/** Canonical application locales. One active locale for the whole app. */

export const SOURCE_LOCALE = 'en' as const;

export const APP_LOCALES = [
  'en',
  'es',
  'my',
  'ar',
  'hi',
  'zh-Hans',
  'zh-Hant',
  'ja',
  'ko',
  'th',
  'fr',
  'de',
  'pt',
  'he',
  'en-XA',
  'ar-XB',
] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export type LocaleMeta = {
  locale: AppLocale;
  /** English label for settings/debug */
  englishName: string;
  /** Native endonym shown in the selector */
  nativeName: string;
  dir: 'ltr' | 'rtl';
  /** BCP 47 tag for Intl / html lang */
  bcp47: string;
  /** Optional Google/Apple locale hint */
  providerLocale: string;
  pseudo?: 'expand' | 'rtl';
  machineTranslated?: boolean;
};

export const LOCALE_META: Record<AppLocale, LocaleMeta> = {
  en: {
    locale: 'en',
    englishName: 'English',
    nativeName: 'English',
    dir: 'ltr',
    bcp47: 'en',
    providerLocale: 'en',
  },
  es: {
    locale: 'es',
    englishName: 'Spanish',
    nativeName: 'Español',
    dir: 'ltr',
    bcp47: 'es',
    providerLocale: 'es',
    machineTranslated: true,
  },
  my: {
    locale: 'my',
    englishName: 'Burmese',
    nativeName: 'မြန်မာ',
    dir: 'ltr',
    bcp47: 'my',
    providerLocale: 'my',
    machineTranslated: true,
  },
  ar: {
    locale: 'ar',
    englishName: 'Arabic',
    nativeName: 'العربية',
    dir: 'rtl',
    bcp47: 'ar',
    providerLocale: 'ar',
    machineTranslated: true,
  },
  hi: {
    locale: 'hi',
    englishName: 'Hindi',
    nativeName: 'हिन्दी',
    dir: 'ltr',
    bcp47: 'hi',
    providerLocale: 'hi',
    machineTranslated: true,
  },
  'zh-Hans': {
    locale: 'zh-Hans',
    englishName: 'Simplified Chinese',
    nativeName: '简体中文',
    dir: 'ltr',
    bcp47: 'zh-Hans',
    providerLocale: 'zh-CN',
    machineTranslated: true,
  },
  'zh-Hant': {
    locale: 'zh-Hant',
    englishName: 'Traditional Chinese',
    nativeName: '繁體中文',
    dir: 'ltr',
    bcp47: 'zh-Hant',
    providerLocale: 'zh-TW',
    machineTranslated: true,
  },
  ja: {
    locale: 'ja',
    englishName: 'Japanese',
    nativeName: '日本語',
    dir: 'ltr',
    bcp47: 'ja',
    providerLocale: 'ja',
    machineTranslated: true,
  },
  ko: {
    locale: 'ko',
    englishName: 'Korean',
    nativeName: '한국어',
    dir: 'ltr',
    bcp47: 'ko',
    providerLocale: 'ko',
    machineTranslated: true,
  },
  th: {
    locale: 'th',
    englishName: 'Thai',
    nativeName: 'ไทย',
    dir: 'ltr',
    bcp47: 'th',
    providerLocale: 'th',
    machineTranslated: true,
  },
  fr: {
    locale: 'fr',
    englishName: 'French',
    nativeName: 'Français',
    dir: 'ltr',
    bcp47: 'fr',
    providerLocale: 'fr',
    machineTranslated: true,
  },
  de: {
    locale: 'de',
    englishName: 'German',
    nativeName: 'Deutsch',
    dir: 'ltr',
    bcp47: 'de',
    providerLocale: 'de',
    machineTranslated: true,
  },
  pt: {
    locale: 'pt',
    englishName: 'Portuguese',
    nativeName: 'Português',
    dir: 'ltr',
    bcp47: 'pt',
    providerLocale: 'pt',
    machineTranslated: true,
  },
  he: {
    locale: 'he',
    englishName: 'Hebrew',
    nativeName: 'עברית',
    dir: 'rtl',
    bcp47: 'he',
    providerLocale: 'he',
    machineTranslated: true,
  },
  'en-XA': {
    locale: 'en-XA',
    englishName: 'Pseudo Expanded',
    nativeName: '[!! Pseudo Expanded !!]',
    dir: 'ltr',
    bcp47: 'en',
    providerLocale: 'en',
    pseudo: 'expand',
  },
  'ar-XB': {
    locale: 'ar-XB',
    englishName: 'Pseudo RTL',
    nativeName: '‮[!! Pseudo RTL !!]‬',
    dir: 'rtl',
    bcp47: 'ar',
    providerLocale: 'ar',
    pseudo: 'rtl',
  },
};

export const DISPLAY_NAME_TO_LOCALE: Record<string, AppLocale> = {
  English: 'en',
  Spanish: 'es',
  Burmese: 'my',
  Arabic: 'ar',
  Hindi: 'hi',
  Chinese: 'zh-Hans',
  'Simplified Chinese': 'zh-Hans',
  'Traditional Chinese': 'zh-Hant',
  Japanese: 'ja',
  Korean: 'ko',
  Thai: 'th',
  French: 'fr',
  German: 'de',
  Portuguese: 'pt',
  Hebrew: 'he',
  Russian: 'en',
};

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return Boolean(value && (APP_LOCALES as readonly string[]).includes(value));
}

export function resolveAppLocale(raw: unknown): AppLocale | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (isAppLocale(trimmed)) return trimmed;
  const mapped = DISPLAY_NAME_TO_LOCALE[trimmed];
  return mapped ?? null;
}

export function localeEnglishName(locale: AppLocale): string {
  return LOCALE_META[locale].englishName;
}
