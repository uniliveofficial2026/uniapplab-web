/**
 * Shared Explore / mention query normalization.
 * Keep this free of cloud imports to avoid cycles with profileSearch ↔ userSearch.
 */

/** Instagram-style `@handle` → `handle` (usernames in DB have no leading `@`). */
export function normalizeSearchTerm(query: string): string {
  return query
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}
