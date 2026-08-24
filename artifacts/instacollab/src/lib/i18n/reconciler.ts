import type { AppLocale } from './locales';
import type { I18nCatalog } from './types';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA']);
const ATTRS = ['placeholder', 'title', 'aria-label', 'aria-placeholder', 'alt', 'aria-roledescription'];

const KEEP_RE =
  /^(UniLive’s|UniLive's|UniLive|VIP|SVIP|OK|K-Star|YouTube|USD|ID)$/i;
const URL_RE = /^(https?:\/\/|mailto:|tel:)/i;
const MENTION_RE = /^[@#][\w.]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_RE = /^\d{4,8}$/;
const IDISH_RE = /^[a-z0-9_-]{8,}$/i;

function shouldSkipText(raw: string): boolean {
  const text = raw.trim();
  if (!text) return true;
  if (KEEP_RE.test(text)) return true;
  if (URL_RE.test(text) || MENTION_RE.test(text) || EMAIL_RE.test(text) || OTP_RE.test(text)) return true;
  if (IDISH_RE.test(text) && !/\s/.test(text)) return true;
  return false;
}

function isSkippableNode(node: Node): boolean {
  if (!(node instanceof HTMLElement)) {
    const parent = node.parentElement;
    return parent ? isSkippableNode(parent) : false;
  }
  if (SKIP_TAGS.has(node.tagName)) return true;
  if (node.isContentEditable) return true;
  if (node.dataset.ugc === '1' || node.dataset.i18nSkip === '1' || node.dataset.username === '1') return true;
  if (node.closest?.('[data-ugc],[data-i18n-skip],[data-username],[contenteditable="true"]')) return true;
  return false;
}

function buildLookup(catalog: I18nCatalog, previous?: I18nCatalog | null): Map<string, string> {
  const map = new Map<string, string>();
  const add = (from: string, to: string) => {
    if (!from || from === to) return;
    map.set(from, to);
    map.set(from.trim(), to);
  };
  for (const [en, localized] of Object.entries(catalog.literals)) add(en, localized);
  for (const [key, localized] of Object.entries(catalog.keys)) {
    const en = previous?.locale === 'en' ? previous.keys[key] : undefined;
    if (en) add(en, localized);
  }
  if (previous && previous.locale !== catalog.locale) {
    for (const [en, prevLoc] of Object.entries(previous.literals)) {
      const next = catalog.literals[en];
      if (next) add(prevLoc, next);
    }
    for (const key of Object.keys(catalog.keys)) {
      const prevVal = previous.keys[key];
      const nextVal = catalog.keys[key];
      if (prevVal && nextVal) add(prevVal, nextVal);
    }
  }
  return map;
}

export function reconcileMountedText(
  root: ParentNode,
  catalog: I18nCatalog,
  previous?: I18nCatalog | null,
): { replaced: number; remainingPrevious: number } {
  const lookup = buildLookup(catalog, previous);
  let replaced = 0;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  for (const node of texts) {
    if (isSkippableNode(node)) continue;
    const value = node.nodeValue ?? '';
    const trimmed = value.trim();
    if (shouldSkipText(trimmed)) continue;
    const next = lookup.get(trimmed) ?? lookup.get(value);
    if (!next || next === trimmed) continue;
    const leading = value.match(/^\s*/)?.[0] ?? '';
    const trailing = value.match(/\s*$/)?.[0] ?? '';
    node.nodeValue = `${leading}${next}${trailing}`;
    replaced += 1;
  }

  const elements = root.querySelectorAll?.('*') ?? [];
  for (const el of elements) {
    if (!(el instanceof HTMLElement) || isSkippableNode(el)) continue;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const ph = el.getAttribute('placeholder');
      if (ph && !shouldSkipText(ph) && lookup.has(ph)) {
        el.setAttribute('placeholder', lookup.get(ph)!);
        replaced += 1;
      }
    }
    for (const attr of ATTRS) {
      const current = el.getAttribute(attr);
      if (!current || shouldSkipText(current)) continue;
      const next = lookup.get(current);
      if (next && next !== current) {
        el.setAttribute(attr, next);
        replaced += 1;
      }
    }
  }

  return { replaced, remainingPrevious: 0 };
}

export function countPreviousLanguageWords(
  root: ParentNode,
  previousCatalog: I18nCatalog,
  nextCatalog: I18nCatalog,
): number {
  const previousValues = new Set<string>();
  for (const v of Object.values(previousCatalog.keys)) if (v.trim()) previousValues.add(v.trim());
  for (const v of Object.values(previousCatalog.literals)) if (v.trim()) previousValues.add(v.trim());
  for (const v of Object.values(nextCatalog.keys)) previousValues.delete(v.trim());
  for (const v of Object.values(nextCatalog.literals)) previousValues.delete(v.trim());

  let count = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (isSkippableNode(node)) continue;
    const trimmed = (node.nodeValue ?? '').trim();
    if (trimmed && previousValues.has(trimmed)) count += 1;
  }
  return count;
}

export function countRawTranslationKeys(root: ParentNode): number {
  const keyRe = /^[a-z]+(\.[a-zA-Z0-9_]+)+$/;
  let count = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const trimmed = ((walker.currentNode as Text).nodeValue ?? '').trim();
    if (keyRe.test(trimmed)) count += 1;
  }
  return count;
}

export type AppLocaleCommit = AppLocale;
