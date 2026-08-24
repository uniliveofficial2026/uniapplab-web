import type { TranslationParams } from './types';

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}|\{([a-zA-Z0-9_]+)\}/g;

export function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(PLACEHOLDER_RE, (match, a: string, b: string) => {
    const name = a || b;
    if (!(name in params) || params[name] == null) return match;
    return String(params[name]);
  });
}

export function listPlaceholders(template: string): string[] {
  const names = new Set<string>();
  template.replace(PLACEHOLDER_RE, (_m, a: string, b: string) => {
    names.add(a || b);
    return _m;
  });
  return [...names];
}

export function placeholdersMatch(source: string, target: string): boolean {
  const a = listPlaceholders(source).sort();
  const b = listPlaceholders(target).sort();
  if (a.length !== b.length) return false;
  return a.every((name, i) => name === b[i]);
}
