export type LocalGamePlayKind = 'web' | 'native';

export type LocalGameStatus = 'Installed' | 'Ready' | 'Needs Setup';

export type LocalGameRecord = {
  id: string;
  name: string;
  status: LocalGameStatus;
  playtime: string;
  image: string;
  /** Data-URL thumbnail extracted from the game's own artwork, if any. */
  coverUrl?: string;
  fileName: string;
  sizeBytes: number;
  playKind: LocalGamePlayKind;
  entryPath?: string;
  totalPlayMs: number;
  lastPlayedAt?: number;
  importedAt: number;
  /** Stable catalog id when this record was seeded from a bundled game. */
  catalogId?: string;
  /** Catalog ZIP revision last imported (used to refresh when the shipped ZIP updates). */
  catalogZipRevision?: string;
  /**
   * Preferred Play URL (e.g. `http://127.0.0.1:3000/` — the verified fixed UI).
   * Used when that host is reachable; otherwise `embeddedAppUrl`.
   */
  productionAppUrl?: string;
  /** Same-origin UniLive path built from the same package (production fallback). */
  embeddedAppUrl?: string;
};

export type LocalGameBundleFile = {
  path: string;
  mime: string;
  data: ArrayBuffer;
};

export type LocalGameBundle = {
  id: string;
  playKind: LocalGamePlayKind;
  entryPath: string;
  files: LocalGameBundleFile[];
};
