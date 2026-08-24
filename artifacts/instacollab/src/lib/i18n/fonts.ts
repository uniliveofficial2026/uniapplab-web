import type { AppLocale } from './locales';

const FONT_HREF: Partial<Record<AppLocale, string>> = {
  ar: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&display=swap',
  he: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;600;700&display=swap',
  my: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Myanmar:wght@400;600;700&display=swap',
  th: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700&display=swap',
  hi: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap',
  'zh-Hans': 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;600;700&display=swap',
  'zh-Hant': 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;600;700&display=swap',
  ja: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap',
  ko: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap',
  'ar-XB': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&display=swap',
};

const loaded = new Set<string>();

export async function ensureLocaleFonts(locale: AppLocale): Promise<void> {
  const href = FONT_HREF[locale];
  if (!href || typeof document === 'undefined') return;
  if (!loaded.has(href)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.i18nFont = locale;
    document.head.appendChild(link);
    loaded.add(href);
  }
  try {
    await Promise.race([
      document.fonts?.ready ?? Promise.resolve(),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    /* fonts are best-effort; catalog still commits */
  }
}

export function prefetchLocaleFonts(locales: AppLocale[]): void {
  for (const locale of locales) {
    const href = FONT_HREF[locale];
    if (!href || typeof document === 'undefined' || loaded.has(href)) continue;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = href;
    document.head.appendChild(link);
  }
}
