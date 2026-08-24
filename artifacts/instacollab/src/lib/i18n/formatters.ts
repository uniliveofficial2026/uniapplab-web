import type { AppLocale } from './locales';
import { LOCALE_META } from './locales';

let numberFmt: Intl.NumberFormat | null = null;
let dateFmt: Intl.DateTimeFormat | null = null;
let relativeFmt: Intl.RelativeTimeFormat | null = null;
let activeLocale: AppLocale | null = null;

export function invalidateFormatters(): void {
  numberFmt = null;
  dateFmt = null;
  relativeFmt = null;
}

export function activateFormatterLocale(locale: AppLocale): void {
  if (activeLocale === locale && numberFmt) return;
  activeLocale = locale;
  const tag = LOCALE_META[locale].bcp47;
  numberFmt = new Intl.NumberFormat(tag);
  dateFmt = new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeStyle: 'short' });
  try {
    relativeFmt = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });
  } catch {
    relativeFmt = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  }
}

export function formatNumber(value: number, locale: AppLocale): string {
  activateFormatterLocale(locale);
  return numberFmt!.format(value);
}

export function formatDateTime(value: number | Date, locale: AppLocale): string {
  activateFormatterLocale(locale);
  return dateFmt!.format(typeof value === 'number' ? new Date(value) : value);
}

export function formatRelative(fromMs: number, locale: AppLocale, now = Date.now()): string {
  activateFormatterLocale(locale);
  const deltaSec = Math.round((fromMs - now) / 1000);
  const abs = Math.abs(deltaSec);
  if (abs < 60) return relativeFmt!.format(Math.round(deltaSec), 'second');
  if (abs < 3600) return relativeFmt!.format(Math.round(deltaSec / 60), 'minute');
  if (abs < 86400) return relativeFmt!.format(Math.round(deltaSec / 3600), 'hour');
  return relativeFmt!.format(Math.round(deltaSec / 86400), 'day');
}
