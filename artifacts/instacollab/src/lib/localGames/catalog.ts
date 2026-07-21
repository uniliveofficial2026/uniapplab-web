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
   * Same-origin UniLive path for Play Now (in-app iframe).
   * Never localhost / separate servers — the game is part of UniLive.
   */
  productionAppUrl: string;
};

/** Bundled games: Play opens UniLive’s embedded production build. */
export const LOCAL_GAME_CATALOG: LocalGameCatalogEntry[] = [
  {
    id: 'catalog_greedy_casino_slot',
    cardName: 'Greedy Casino Slot',
    description:
      'Food roulette with multipliers — desktop, mobile, and tablet wheel layout.',
    zipUrl: '/local-games/remix_-greedy-casino-slot.zip',
    zipFileName: 'remix_-greedy-casino-slot.zip',
    // Points Play at UniLive embed (fixed wheel), not an external :3000 server.
    zipRevision: '2026-07-21-wheel-embed',
    image: 'bg-gradient-to-tr from-amber-500 to-red-700',
    productionAppUrl: '/games/greedy-slot/',
  },
];

export function findCatalogEntry(catalogId: string): LocalGameCatalogEntry | undefined {
  return LOCAL_GAME_CATALOG.find((entry) => entry.id === catalogId);
}
