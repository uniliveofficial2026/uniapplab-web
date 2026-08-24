import React, { useEffect } from 'react';
import { Globe } from 'lucide-react';
import {
  APP_LOCALES,
  LOCALE_META,
  localeEnglishName,
  resolveAppLocale,
  type AppLocale,
} from '../../lib/i18n/locales';
import { useI18n } from '../../lib/i18n/I18nContext';
import { useToast } from '../../lib/ToastContext';

interface Props {
  value?: string;
  onChange?: (value: string) => void;
}

export function LanguageSelector({ value, onChange }: Props) {
  const i18n = useI18n();
  const { showToast } = useToast();

  useEffect(() => {
    i18n.prefetchForSelector();
  }, [i18n]);

  const current = resolveAppLocale(value) ?? i18n.locale;

  const handleChange = async (next: AppLocale) => {
    onChange?.(localeEnglishName(next));
    if (next === i18n.locale) return;
    const result = await i18n.switchLocale(next);
    if (!result.ok) {
      showToast({ translationKey: result.errorKey });
    }
  };

  const isReady = (locale: AppLocale) =>
    locale === i18n.locale || i18n.selectableLocales.includes(locale) || Boolean(i18n.completeness[locale]?.pass);

  return (
    <div className="relative group">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
        <Globe className="w-4 h-4" />
      </div>
      <select
        value={current}
        onChange={(e) => void handleChange(e.target.value as AppLocale)}
        aria-label={i18n.t('common.language')}
        disabled={i18n.preparing}
        className="w-full h-12 bg-secondary/50 rounded-xl border border-border pl-12 pr-4 appearance-none focus:ring-2 focus:ring-primary outline-none transition-all cursor-pointer font-medium"
      >
        {APP_LOCALES.map((locale) => (
          <option key={locale} value={locale} disabled={!isReady(locale)}>
            {LOCALE_META[locale].nativeName}
          </option>
        ))}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
