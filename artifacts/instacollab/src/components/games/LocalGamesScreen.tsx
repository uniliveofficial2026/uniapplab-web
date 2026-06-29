import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Circle, Clock, BarChart3, ChevronRight, Upload, FolderOpen, Trash2, Loader2 } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import type { LocalGameRecord } from '../../lib/localGames/types';
import { extractBundleCover } from '../../lib/localGames/cover';
import { importGameFile, importGameFolder } from '../../lib/localGames/import';
import {
  deleteLocalGameBundle,
  getLocalGameBundle,
  getLocalGamesStorageBytes,
} from '../../lib/localGames/vault';
import { formatBytes, formatPlaytime } from '../../lib/localGames/format';
import { ensureLocalGameServiceWorker } from '../../lib/localGames/player';
import { LocalGamePlayer } from './LocalGamePlayer';

const STORAGE_QUOTA_BYTES = 500 * 1024 * 1024 * 1024;

function GameArtwork({
  game,
  className,
  children,
}: {
  game: LocalGameRecord;
  className: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden ${className} ${game.coverUrl ? 'bg-secondary' : game.image}`}>
      {game.coverUrl && (
        <img
          src={game.coverUrl}
          alt={`${game.name} preview`}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      )}
      {children}
    </div>
  );
}

export function LocalGamesScreen() {
  const db = useDB();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [games, setGames] = useState<LocalGameRecord[]>(() =>
    db.load<LocalGameRecord[]>('local_games', [])
  );
  const [storageBytes, setStorageBytes] = useState(0);
  const [importing, setImporting] = useState(false);
  const [playingGame, setPlayingGame] = useState<LocalGameRecord | null>(null);

  const persistGames = useCallback(
    (next: LocalGameRecord[]) => {
      setGames(next);
      db.save('local_games', next);
    },
    [db]
  );

  const refreshStorage = useCallback(async () => {
    const bytes = await getLocalGamesStorageBytes();
    setStorageBytes(bytes);
  }, []);

  useEffect(() => {
    void ensureLocalGameServiceWorker();
    void refreshStorage();
  }, [refreshStorage]);

  // Backfill preview covers for games imported before cover extraction existed.
  const coverBackfillDone = useRef(false);
  useEffect(() => {
    if (coverBackfillDone.current) return;
    const missing = games.filter((g) => !g.coverUrl);
    if (missing.length === 0) return;
    coverBackfillDone.current = true;

    let cancelled = false;
    (async () => {
      const covers = new Map<string, string>();
      for (const game of missing) {
        try {
          const bundle = await getLocalGameBundle(game.id);
          if (!bundle) continue;
          const cover = await extractBundleCover(bundle.files);
          if (cover) covers.set(game.id, cover);
        } catch {
          // best-effort: keep gradient fallback
        }
      }
      if (cancelled || covers.size === 0) return;
      setGames((current) => {
        const next = current.map((g) =>
          covers.has(g.id) ? { ...g, coverUrl: covers.get(g.id) } : g
        );
        db.save('local_games', next);
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot backfill on mount
  }, []);

  const featuredGame =
    [...games].sort((a, b) => (b.lastPlayedAt ?? b.importedAt) - (a.lastPlayedAt ?? a.importedAt))[0] ??
    games[0];

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImporting(true);
    try {
      const record = await importGameFile(file);
      persistGames([record, ...games]);
      await refreshStorage();
      showToast(
        record.playKind === 'web'
          ? `"${record.name}" imported — tap Play to launch.`
          : `"${record.name}" installed — download to run on desktop.`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleImportFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    e.target.value = '';
    if (!fileList || fileList.length === 0) return;

    setImporting(true);
    try {
      const record = await importGameFolder(fileList);
      persistGames([record, ...games]);
      await refreshStorage();
      showToast(`"${record.name}" folder imported — ready to play.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Folder import failed.');
    } finally {
      setImporting(false);
    }
  };

  const launchGame = (game: LocalGameRecord) => {
    setPlayingGame(game);
  };

  const handleSessionEnd = (gameId: string, playedMs: number) => {
    const next = games.map((g) => {
      if (g.id !== gameId) return g;
      const totalPlayMs = g.totalPlayMs + playedMs;
      return {
        ...g,
        totalPlayMs,
        playtime: formatPlaytime(totalPlayMs),
        lastPlayedAt: Date.now(),
        status: g.playKind === 'web' ? ('Ready' as const) : g.status,
      };
    });
    persistGames(next);
  };

  const removeGame = async (game: LocalGameRecord) => {
    if (!confirm(`Remove "${game.name}" from your library?`)) return;
    await deleteLocalGameBundle(game.id);
    persistGames(games.filter((g) => g.id !== game.id));
    await refreshStorage();
    showToast(`Removed "${game.name}".`);
  };

  const storagePct = Math.min(100, (storageBytes / STORAGE_QUOTA_BYTES) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 md:p-10 max-w-7xl mx-auto space-y-12"
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleImportFile}
        accept=".html,.htm,.zip,.exe,.app,.dmg,.msi,.deb,.bat,.cmd,application/zip,application/x-msdownload"
      />
      <input
        type="file"
        ref={folderInputRef}
        className="hidden"
        onChange={handleImportFolder}
        // @ts-expect-error webkitdirectory is non-standard but widely supported
        webkitdirectory=""
        directory=""
        multiple
      />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-4xl font-black text-foreground tracking-tighter">My Library</h1>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              type="button"
              disabled={importing}
              onClick={() => folderInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-foreground hover:bg-secondary/80 rounded-xl text-xs font-black transition-all w-full sm:w-auto justify-center disabled:opacity-60"
            >
              <FolderOpen className="w-4 h-4" /> Import Game Folder
            </button>
            <button
              type="button"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground hover:opacity-90 rounded-xl text-xs font-black transition-all w-full sm:w-auto justify-center disabled:opacity-60"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {importing ? 'Importing…' : 'Import Game'}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground font-semibold -mt-2">
          Upload .html or .zip web games to play in-browser, or install .exe / .app files for desktop launch.
        </p>

        {featuredGame ? (
          <motion.div whileHover={{ scale: 1.01 }}>
            <GameArtwork
              game={featuredGame}
              className="h-64 rounded-3xl text-white"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="relative h-full p-8 flex flex-col justify-end">
                <div className="absolute top-6 left-8 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                  {featuredGame.lastPlayedAt ? 'Recently Played' : 'Ready to Play'}
                </div>
                <h2 className="text-3xl font-black">{featuredGame.name}</h2>
                <p className="text-white/80 font-semibold text-xs mt-1">
                  {featuredGame.playKind === 'web' ? 'Web game' : 'Desktop executable'} ·{' '}
                  {featuredGame.playtime}
                </p>
                <button
                  type="button"
                  onClick={() => launchGame(featuredGame)}
                  className="mt-4 w-36 bg-white text-black font-black text-xs py-3 rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-3 h-3 fill-black" />
                  {featuredGame.playKind === 'web' ? 'Play Now' : 'Open'}
                </button>
              </div>
            </GameArtwork>
          </motion.div>
        ) : (
          <div className="h-48 rounded-3xl border border-dashed border-border bg-secondary/20 flex flex-col items-center justify-center gap-2 text-center px-6">
            <p className="text-sm font-black text-foreground">No games imported yet</p>
            <p className="text-[11px] text-muted-foreground font-semibold max-w-sm">
              Import an HTML5 game, a ZIP web build, or a desktop executable to fill your library.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-black text-foreground">Installed Games ({games.length})</h3>

        {games.length === 0 ? (
          <p className="text-xs text-muted-foreground font-semibold">Your imported games will appear here.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {games.map((game) => (
                <motion.div
                  key={game.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="group bg-card border border-border rounded-3xl overflow-hidden hover:border-primary/40 transition-all shadow-sm flex flex-col"
                >
                  <button
                    type="button"
                    onClick={() => launchGame(game)}
                    className="block w-full text-left"
                    title={game.playKind === 'web' ? 'Play' : 'Open'}
                  >
                    <GameArtwork game={game} className="aspect-video w-full">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="w-12 h-12 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                          <Play className="w-5 h-5 fill-black ml-0.5" />
                        </span>
                      </div>
                      <span className="absolute bottom-3 left-4 text-white text-[10px] font-black uppercase tracking-wider bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-full">
                        {game.playKind === 'web' ? 'Play in browser' : 'Desktop'}
                      </span>
                    </GameArtwork>
                  </button>

                  <div className="p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-sm text-foreground truncate">{game.name}</h4>
                      <p className="text-[10px] text-muted-foreground font-semibold truncate mt-0.5">
                        {game.fileName} · {formatBytes(game.sizeBytes)}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground font-semibold">
                        <span className="flex items-center gap-1">
                          <Circle
                            className={`w-2 h-2 fill-current ${
                              game.status === 'Ready' || game.status === 'Installed'
                                ? 'text-emerald-500'
                                : 'text-amber-500'
                            }`}
                          />
                          {game.status}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {game.playtime}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => removeGame(game)}
                        className="p-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => launchGame(game)}
                        className="p-3 bg-secondary hover:bg-primary hover:text-primary-foreground rounded-xl transition-all"
                        title={game.playKind === 'web' ? 'Play' : 'Open'}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-3xl p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-black text-sm">Storage Usage</h4>
            <p className="text-[11px] text-muted-foreground font-semibold">
              {formatBytes(storageBytes)} / {formatBytes(STORAGE_QUOTA_BYTES)} used across library
            </p>
          </div>
        </div>
        <div className="h-2 w-full sm:w-48 bg-secondary rounded-full overflow-hidden shrink-0">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${Math.max(storagePct, games.length > 0 ? 2 : 0)}%` }}
          />
        </div>
      </div>

      {playingGame && (
        <LocalGamePlayer
          game={playingGame}
          onClose={() => setPlayingGame(null)}
          onSessionEnd={handleSessionEnd}
        />
      )}
    </motion.div>
  );
}
