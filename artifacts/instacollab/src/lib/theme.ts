/** Apply light/dark theme to the document root (used by App settings sync). */
export function applyDocumentTheme(theme: 'light' | 'dark'): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  const themeColor = theme === 'dark' ? '#020617' : '#f8fafc';
  let meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', themeColor);
}

export function readStoredThemePreference(): 'light' | 'dark' {
  try {
    const raw = localStorage.getItem('app_settings');
    if (raw && raw !== 'undefined') {
      const parsed = JSON.parse(raw) as { theme?: string };
      if (parsed.theme === 'light' || parsed.theme === 'dark') return parsed.theme;
    }
  } catch {
    /* ignore */
  }
  return 'dark';
}

/** Call before React paints to avoid theme flash on refresh. */
export function bootstrapDocumentTheme(): void {
  applyDocumentTheme(readStoredThemePreference());
}

export function nextTheme(current: string | undefined): 'light' | 'dark' {
  return current === 'dark' ? 'light' : 'dark';
}
