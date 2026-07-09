/**
 * App-wide cache-first policy — never show blocking loaders, skeletons, or sync toasts.
 * UI paints from localStorage / IndexedDB mirrors; cloud merges in place with zero flash.
 */
import type { ReactNode } from 'react';
import { readSessionCache, isAppUiCacheReady } from './sessionCache';
import { safeLocalStorage } from './utils';

/** Session hint or synchronous localStorage login mirror (before IDB opens). */
export function hasInstantSessionCache(): boolean {
  if (readSessionCache()) return true;
  if (isAppUiCacheReady()) return true;
  try {
    return (
      safeLocalStorage.getItem('isLoggedIn') === 'true' &&
      Boolean(safeLocalStorage.getItem('currentUserId'))
    );
  } catch {
    return false;
  }
}

/** Suspense / route fallback — always null so last-painted UI stays visible (no flash). */
export function instantSuspenseFallback(_blocking?: ReactNode): ReactNode {
  return null;
}
