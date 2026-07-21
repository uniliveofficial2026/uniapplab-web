export type LocalGameCatalogEntry = {
  id: string;
  /** Label shown on the library card only — import uses the ZIP unchanged. */
  cardName: string;
  description: string;
  /** Exact original archive shipped under public/local-games (bytes untouched). */
  zipUrl: string;
  zipFileName: string;
  /** Bump when replacing the shipped ZIP so library re-imports the new bytes. */
  zipRevision: string;
  image: string;
  /**
   * Preferred Play URL — the fixed game on the local package server
   * (`http://127.0.0.1:3000/`). Used when that server is reachable.
   */
  productionAppUrl: string;
  /**
   * Same-origin UniLive fallback when :3000 is not available (production).
   * Built from the same remix package that runs on :3000.
   */
  embeddedAppUrl: string;
};

/** Bundled games: prefer the fixed :3000 server; fall back to UniLive embed. */
export const LOCAL_GAME_CATALOG: LocalGameCatalogEntry[] = [
  {
    id: 'catalog_greedy_casino_slot',
    cardName: 'Greedy Casino Slot',
    description:
      'Food roulette with multipliers — desktop, mobile, and tablet wheel layout.',
    zipUrl: '/local-games/remix_-greedy-casino-slot.zip',
    zipFileName: 'remix_-greedy-casino-slot.zip',
    zipRevision: '2026-07-21-from-3000',
    image: 'bg-gradient-to-tr from-amber-500 to-red-700',
    // Exact fixed UI the user verified at http://127.0.0.1:3000/
    productionAppUrl: 'http://127.0.0.1:3000/',
    embeddedAppUrl: '/games/greedy-slot/',
  },
];

export function findCatalogEntry(catalogId: string): LocalGameCatalogEntry | undefined {
  return LOCAL_GAME_CATALOG.find((entry) => entry.id === catalogId);
}
