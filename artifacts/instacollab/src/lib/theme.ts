/** Apply light/dark theme to the document root (used by App settings sync). */
export function applyDocumentTheme(theme: 'light' | 'dark'): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function nextTheme(current: string | undefined): 'light' | 'dark' {
  return current === 'dark' ? 'light' : 'dark';
}
