export type SearchQueryMode = 'all' | 'tag' | 'mention';

export function parseSearchQuery(query: string): { mode: SearchQueryMode; term: string } {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return { mode: 'all', term: '' };
  if (trimmed.startsWith('#')) return { mode: 'tag', term: trimmed.slice(1) };
  if (trimmed.startsWith('@')) return { mode: 'mention', term: trimmed.slice(1) };
  return { mode: 'all', term: trimmed };
}

export function extractTags(text: string) {
  return (text.match(/#[a-zA-Z0-9_]+/g) || []).map((item) => item.slice(1).toLowerCase());
}

export function extractMentions(text: string) {
  return (text.match(/@[a-zA-Z0-9_]+/g) || []).map((item) => item.slice(1).toLowerCase());
}

export function matchByQuery(text: string, query: string) {
  const { mode, term } = parseSearchQuery(query);
  if (!term) return true;
  const lowerText = text.toLowerCase();
  if (mode === 'tag') return extractTags(text).some((tag) => tag.includes(term));
  if (mode === 'mention') return extractMentions(text).some((mention) => mention.includes(term));
  return lowerText.includes(term);
}
