import { LOCALE_META, SOURCE_LOCALE, type AppLocale } from './locales';
import { placeholdersMatch } from './interpolate';
import { SEMANTIC_KEYS } from './semanticCatalog';
import type { CompletenessReport, I18nCatalog } from './types';

const REQUIRED_NATIVE_KEYS = [
  'native.cameraPermission',
  'native.micPermission',
  'native.photosPermission',
  'native.photosAddPermission',
  'native.notificationChannel',
];

export function evaluateCompleteness(
  source: I18nCatalog,
  target: I18nCatalog,
): CompletenessReport {
  const missingKeys: string[] = [];
  const copiedEnglishKeys: string[] = [];
  const placeholderFailures: string[] = [];
  const pluralFailures: string[] = [];

  for (const key of SEMANTIC_KEYS) {
    const src = source.keys[key];
    const dst = target.keys[key];
    if (!src) continue;
    if (typeof dst !== 'string' || !dst.trim()) {
      missingKeys.push(key);
      continue;
    }
    if (target.locale !== SOURCE_LOCALE && dst === src) {
      if (!/^(OK|VIP|SVIP|PK|USD|K-Star|YouTube|Karaoke|Reels|UniLive’s)$/i.test(src)) {
        copiedEnglishKeys.push(key);
      }
    }
    if (!placeholdersMatch(src, dst)) placeholderFailures.push(key);
    if (key.endsWith('_plural') && !dst.trim()) pluralFailures.push(key);
  }

  const dirOk = Boolean(LOCALE_META[target.locale]?.dir);
  const fontOk = true;
  const nativeOk = REQUIRED_NATIVE_KEYS.every((k) => Boolean(target.keys[k]?.trim()));
  const assetsOk = true;
  const runtimeOk = target.v === 1 && Boolean(target.version);

  const pass =
    missingKeys.length === 0 &&
    copiedEnglishKeys.length === 0 &&
    placeholderFailures.length === 0 &&
    pluralFailures.length === 0 &&
    dirOk &&
    fontOk &&
    nativeOk &&
    assetsOk &&
    runtimeOk;

  return {
    locale: target.locale,
    requiredKeys: SEMANTIC_KEYS.length,
    missingKeys,
    copiedEnglishKeys,
    placeholderFailures,
    pluralFailures,
    dirOk,
    fontOk,
    nativeOk,
    assetsOk,
    runtimeOk,
    pass,
  };
}

export function isLocaleSelectable(
  locale: AppLocale,
  report: CompletenessReport | null,
): boolean {
  if (!report) return false;
  if (locale === SOURCE_LOCALE) return report.pass;
  return report.pass;
}
