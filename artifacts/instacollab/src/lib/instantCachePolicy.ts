/**
 * App-wide cache-first policy — never show blocking loaders, skeletons, or sync toasts.
 * UI paints from localStorage / IndexedDB mirrors; cloud merges in place with zero flash.
 */
import { createElement, type ReactNode } from 'react';
import { readSessionCache } from './sessionCache';
import { safeLocalStorage } from './utils';

/** Session hint or synchronous localStorage login mirror (before IDB opens). */
export function hasInstantSessionCache(): boolean {
  if (readSessionCache()) return true;
  try {
    return (
      safeLocalStorage.getItem('isLoggedIn') === 'true' &&
      Boolean(safeLocalStorage.getItem('currentUserId'))
    );
  } catch {
    return false;
  }
}

/**
 * Suspense fallback while a lazy screen chunk loads.
 * NEVER return null — that unmounts the tree and paints a blank page.
 */
export function instantSuspenseFallback(_blocking?: ReactNode): ReactNode {
  return createElement(
    'div',
    {
      className:
        'flex h-full min-h-[50dvh] w-full flex-1 items-center justify-center bg-background text-foreground',
      'aria-busy': true,
      'aria-label': 'Loading',
    },
    createElement('div', {
      className: 'h-9 w-9 animate-pulse rounded-full bg-muted/80',
    }),
  );
}
