import type { AppLocale } from './locales';
import { SOURCE_LOCALE } from './locales';

export type UgcEntityType = 'message' | 'post' | 'comment' | 'bio' | 'caption' | 'live_comment';

export type UgcTranslation = {
  entityType: UgcEntityType;
  entityId: string;
  field: string;
  sourceHash: string;
  sourceLocale?: string;
  original: string;
  translated: string;
  targetLocale: AppLocale;
  machineTranslated: true;
};

const memory = new Map<string, UgcTranslation>();

function cacheKey(entityId: string, field: string, locale: AppLocale, sourceHash: string): string {
  return `${entityId}::${field}::${locale}::${sourceHash}`;
}

export function hashSource(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function rememberUgcTranslation(row: UgcTranslation): void {
  memory.set(cacheKey(row.entityId, row.field, row.targetLocale, row.sourceHash), row);
}

export function getCachedUgcTranslation(
  entityId: string,
  field: string,
  locale: AppLocale,
  original: string,
): UgcTranslation | null {
  return memory.get(cacheKey(entityId, field, locale, hashSource(original))) ?? null;
}

function isProtectedToken(text: string): boolean {
  return (
    /^[@#]/.test(text) ||
    /^https?:\/\//i.test(text) ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ||
    /^\d+$/.test(text)
  );
}

/** Never overwrite canonical UGC — display derivative only. */
export async function translateUgcText(input: {
  entityType: UgcEntityType;
  entityId: string;
  field: string;
  original: string;
  targetLocale: AppLocale;
  threadAuthorized?: boolean;
}): Promise<UgcTranslation | null> {
  const original = input.original?.trim() ?? '';
  if (!original || input.targetLocale === SOURCE_LOCALE) return null;
  if (isProtectedToken(original)) return null;
  if (input.entityType === 'message' && input.threadAuthorized === false) return null;

  const sourceHash = hashSource(original);
  const hit = getCachedUgcTranslation(input.entityId, input.field, input.targetLocale, original);
  if (hit) return hit;

  try {
    const { apiFetch } = await import('../platformApi');
    const data = await apiFetch<{ translated?: string; sourceLocale?: string }>('/api/i18n/translate', {
      method: 'POST',
      body: JSON.stringify({
        entityType: input.entityType,
        entityId: input.entityId,
        field: input.field,
        original,
        sourceHash,
        targetLocale: input.targetLocale,
      }),
    });
    if (!data?.translated || data.translated === original) return null;
    const row: UgcTranslation = {
      entityType: input.entityType,
      entityId: input.entityId,
      field: input.field,
      sourceHash,
      sourceLocale: data.sourceLocale,
      original,
      translated: data.translated,
      targetLocale: input.targetLocale,
      machineTranslated: true,
    };
    rememberUgcTranslation(row);
    return row;
  } catch {
    return null;
  }
}

export async function translateVisibleUgc(targetLocale: AppLocale): Promise<void> {
  if (typeof document === 'undefined' || targetLocale === SOURCE_LOCALE) return;
  const nodes = document.querySelectorAll<HTMLElement>('[data-ugc]');
  await Promise.all(
    [...nodes].slice(0, 80).map(async (el) => {
      const original = el.getAttribute('data-ugc-original') || el.textContent || '';
      const entityId = el.getAttribute('data-ugc-id') || '';
      const field = el.getAttribute('data-ugc-field') || 'body';
      const entityType = (el.getAttribute('data-ugc-type') || 'post') as UgcEntityType;
      if (!original || !entityId) return;
      const row = await translateUgcText({
        entityType,
        entityId,
        field,
        original,
        targetLocale,
        threadAuthorized: el.getAttribute('data-ugc-authorized') !== '0',
      });
      if (!row) return;
      el.setAttribute('data-ugc-original', original);
      el.textContent = row.translated;
      el.setAttribute('data-machine-translated', '1');
    }),
  );
}
