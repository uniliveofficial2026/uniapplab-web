export {
  APP_LOCALES,
  LOCALE_META,
  SOURCE_LOCALE,
  isAppLocale,
  localeEnglishName,
  resolveAppLocale,
  type AppLocale,
} from './locales';
export type {
  CompletenessReport,
  I18nCatalog,
  I18nPreference,
  TranslatableMessage,
  TranslationParams,
} from './types';
export { interpolate, listPlaceholders, placeholdersMatch } from './interpolate';
export { SEMANTIC_EN, SEMANTIC_KEYS } from './semanticCatalog';
export { semanticKeysFor } from './semanticTranslations';
export {
  CATALOG_VERSION,
  buildEnglishCatalog,
  buildLocaleCatalog,
  getCachedCatalog,
  loadEnglishCatalog,
  loadLocaleCatalog,
  prefetchLocaleCatalogs,
} from './catalogCache';
export { evaluateCompleteness, isLocaleSelectable } from './completeness';
export { I18nProvider, useI18n, useOptionalI18n, scanAtomicSwitch } from './I18nContext';
export { persistI18nPreference, readBootLocale, applyDocumentLocale } from './persist';
export { activateFormatterLocale, formatDateTime, formatNumber, formatRelative, invalidateFormatters } from './formatters';
export { serverBodyToMessage, isTranslatableMessage } from './serverMessage';
export { translateUgcText, translateVisibleUgc, getCachedUgcTranslation } from './ugcClient';
export { resolveLocalizedAsset, EMBEDDED_ASSET_MANIFEST } from './embeddedAssets';
export { reconcileMountedText, countPreviousLanguageWords, countRawTranslationKeys } from './reconciler';
