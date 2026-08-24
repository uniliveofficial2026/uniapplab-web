const scopedCaches = new Set<() => void>();

export function registerUserScopedCacheReset(reset: () => void): () => void {
  scopedCaches.add(reset);
  return () => {
    scopedCaches.delete(reset);
  };
}

/** On account switch: drop user-scoped view models/caches. Keep global catalogs/themes. */
export function isolateAccountSwitch(): void {
  for (const reset of scopedCaches) {
    try {
      reset();
    } catch {
      /* continue */
    }
  }
}
