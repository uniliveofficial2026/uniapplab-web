import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Monitor, Loader2 } from 'lucide-react';
import type { LocalGameRecord } from '../../lib/localGames/types';
import {
  createNativeDownloadUrl,
  ensureLocalGameServiceWorker,
  resolveWebGameLaunchUrl,
} from '../../lib/localGames/player';

type LocalGamePlayerProps = {
  game: LocalGameRecord;
  onClose: () => void;
  onSessionEnd: (gameId: string, playedMs: number) => void;
};

export function LocalGamePlayer({ game, onClose, onSessionEnd }: LocalGamePlayerProps) {
  const startedAtRef = useRef(Date.now());
  const sessionEndedRef = useRef(false);
  const revokeRef = useRef<(() => void) | undefined>(undefined);
  const [launchUrl, setLaunchUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    startedAtRef.current = Date.now();
    let cancelled = false;

    async function prepare() {
      setLoading(true);
      setError(null);
      try {
        if (game.playKind === 'web' && game.entryPath) {
          await ensureLocalGameServiceWorker();
          const launch = await resolveWebGameLaunchUrl(game.id, game.entryPath);
          if (cancelled) {
            launch.revoke?.();
            return;
          }
          revokeRef.current = launch.revoke;
          setLaunchUrl(launch.url);
        } else {
          const native = await createNativeDownloadUrl(game.id);
          if (cancelled) return;
          if (!native) throw new Error('Game files are missing from local storage.');
          setDownloadUrl(native.url);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not launch game.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void prepare();

    return () => {
      cancelled = true;
      revokeRef.current?.();
      revokeRef.current = undefined;
    };
  }, [game.id, game.entryPath, game.playKind]);

  const endSession = () => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    const playedMs = Date.now() - startedAtRef.current;
    if (playedMs > 1000) onSessionEnd(game.id, playedMs);
  };

  const handleClose = () => {
    endSession();
    revokeRef.current?.();
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[3200] bg-black/90 backdrop-blur-md flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-black/60">
        <div className="min-w-0">
          <p className="text-sm font-black text-white truncate">{game.name}</p>
          <p className="text-[10px] text-white/60 font-semibold truncate">
            {game.playKind === 'web' ? 'Playing in browser' : 'Desktop executable'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Close game"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 relative">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-xs font-bold">Preparing game…</p>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white">
            <p className="text-sm font-bold">{error}</p>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl bg-white text-black text-xs font-black"
            >
              Close
            </button>
          </div>
        )}

        {!loading && !error && game.playKind === 'web' && launchUrl && (
          <iframe
            title={game.name}
            src={launchUrl}
            className="w-full h-full border-0 bg-black"
            sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups"
            allow="fullscreen; gamepad"
          />
        )}

        {!loading && !error && game.playKind === 'native' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center text-white">
            <div className="p-4 rounded-2xl bg-white/10">
              <Monitor className="w-10 h-10" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-lg font-black">Ready for desktop launch</h3>
              <p className="text-xs text-white/70 font-semibold leading-relaxed">
                Browsers cannot run {game.fileName} directly. Your file is installed in this library —
                download it and open it on your computer to play.
              </p>
            </div>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={game.fileName}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-black hover:opacity-90 transition-opacity"
              >
                <Download className="w-4 h-4" />
                Download &amp; Run
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
