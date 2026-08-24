import type { AppLocale } from './locales';

export type TranslationParams = Record<string, string | number | boolean | null | undefined>;

export type TranslatableMessage = {
  translationKey: string;
  params?: TranslationParams;
  /** Fallback only while catalogs load — never shown as the committed UI language. */
  fallbackKey?: string;
};

export type I18nCatalog = {
  v: 1;
  locale: AppLocale;
  version: string;
  machineTranslated?: boolean;
  /** Semantic keys → localized sentence */
  keys: Record<string, string>;
  /** Source-English literal → localized sentence (mounted UI reconciler) */
  literals: Record<string, string>;
};

export type CatalogLoadResult = {
  ok: true;
  catalog: I18nCatalog;
} | {
  ok: false;
  errorKey: string;
  detail?: string;
};

export type CompletenessReport = {
  locale: AppLocale;
  requiredKeys: number;
  missingKeys: string[];
  copiedEnglishKeys: string[];
  placeholderFailures: string[];
  pluralFailures: string[];
  dirOk: boolean;
  fontOk: boolean;
  nativeOk: boolean;
  assetsOk: boolean;
  runtimeOk: boolean;
  pass: boolean;
};

export type I18nPreference = {
  locale: AppLocale;
  autoTranslateUgc?: boolean;
};
