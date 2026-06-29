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
