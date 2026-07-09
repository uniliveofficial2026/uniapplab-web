/**
 * @deprecated Boot orchestration lives in main.tsx (light boot — commit 911b57a baseline).
 * Kept for imports only; does not run heavy preload storms.
 */
import { startCacheFirstCloudSync } from './cacheFirstSync';

let started = false;

export function startCacheFirstBoot(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  startCacheFirstCloudSync();
}
