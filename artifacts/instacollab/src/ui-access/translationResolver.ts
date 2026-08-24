import { TRANSLATION_KEYS } from './generated/schemas.generated';

export function resolveTranslationKey(key: string): string {
  if (!(TRANSLATION_KEYS as readonly string[]).includes(key)) {
    throw new Error(`[ui-access] unknown translation key: ${key}`);
  }
  return key;
}

const TRANSLATION_KEY_SET = new Set<string>(TRANSLATION_KEYS as readonly string[]);

export function hasTranslationKey(key: string): boolean {
  return TRANSLATION_KEY_SET.has(key);
}

export function listTranslationKeys(): readonly string[] {
  return TRANSLATION_KEYS;
}
